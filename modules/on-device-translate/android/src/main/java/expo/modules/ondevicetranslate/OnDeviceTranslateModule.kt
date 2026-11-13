package expo.modules.ondevicetranslate

import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * English → another language, translated on the device by Google ML Kit.
 * Each target language needs its model (~30 MB), downloaded once.
 */
class OnDeviceTranslateModule : Module() {
    private val translators = HashMap<String, Translator>()

    private fun code(lang: String): String =
        TranslateLanguage.fromLanguageTag(lang)
            ?: throw IllegalArgumentException("Unsupported language: $lang")

    private fun translator(lang: String): Translator {
        val target = code(lang)
        return synchronized(translators) {
            translators.getOrPut(target) {
                Translation.getClient(
                    TranslatorOptions.Builder()
                        .setSourceLanguage(TranslateLanguage.ENGLISH)
                        .setTargetLanguage(target)
                        .build()
                )
            }
        }
    }

    private fun <T> Task<T>.into(promise: Promise, code: String, map: (T) -> Any?) {
        addOnSuccessListener { promise.resolve(map(it)) }
        addOnFailureListener { promise.reject(code, it.message, it) }
    }

    override fun definition() = ModuleDefinition {
        Name("OnDeviceTranslate")

        OnDestroy {
            synchronized(translators) {
                translators.values.forEach { it.close() }
                translators.clear()
            }
        }

        AsyncFunction("isModelDownloaded") { lang: String, promise: Promise ->
            val model = TranslateRemoteModel.Builder(code(lang)).build()
            RemoteModelManager.getInstance().isModelDownloaded(model)
                .into(promise, "ERR_MODEL_STATUS") { it }
        }

        AsyncFunction("downloadModel") { lang: String, promise: Promise ->
            translator(lang).downloadModelIfNeeded(DownloadConditions.Builder().build())
                .into(promise, "ERR_MODEL_DOWNLOAD") { null }
        }

        AsyncFunction("deleteModel") { lang: String, promise: Promise ->
            val model = TranslateRemoteModel.Builder(code(lang)).build()
            synchronized(translators) { translators.remove(code(lang))?.close() }
            RemoteModelManager.getInstance().deleteDownloadedModel(model)
                .into(promise, "ERR_MODEL_DELETE") { null }
        }

        /** Translates each text, in order. The model must be downloaded. */
        AsyncFunction("translate") { texts: List<String>, lang: String, promise: Promise ->
            val t = translator(lang)
            val tasks = texts.map { s ->
                if (s.isBlank()) Tasks.forResult(s) else t.translate(s)
            }
            Tasks.whenAllSuccess<String>(tasks).into(promise, "ERR_TRANSLATE") { it }
        }
    }
}
