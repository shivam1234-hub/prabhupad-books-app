package expo.modules.wallpapersetter

import android.app.WallpaperManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Build
import android.text.Layout
import android.text.SpannableStringBuilder
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlin.math.max
import kotlin.math.roundToInt

class WallpaperParams : Record {
    @Field var transliteration: String = ""
    @Field var wordForWord: String = ""
    @Field var translation: String = ""
    @Field var reference: String = ""
    @Field var isDark: Boolean = true
}

// One renderable block: a small accent label above a body of text. `text` is a
// CharSequence so the word-for-word block can carry per-word color spans.
private class Block(
    val label: String,
    val text: CharSequence,
    val baseSp: Float,
    val align: Layout.Alignment,
    val italic: Boolean,
    val color: Int,
)

// A laid-out block at a chosen scale, ready to draw.
private class LaidOut(val block: Block, val labelHeight: Float, val layout: StaticLayout)

class WallpaperSetterModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("WallpaperSetter")

        /**
         * Generates a verse wallpaper bitmap containing exactly three things —
         * transliteration, word-for-word, and the full translation — and sets it
         * directly via WallpaperManager. Font sizes are scaled dynamically so the
         * content always fills and fits the screen, however long the verse is.
         */
        AsyncFunction("generateAndSetWallpaper") { params: WallpaperParams, flag: String ->
            val context = appContext.reactContext
                ?: throw Exception("React context unavailable")

            val dm = context.resources.displayMetrics
            val w = dm.widthPixels
            val h = dm.heightPixels
            val density = dm.density

            val bgColor       = if (params.isDark) Color.parseColor("#0E0B07") else Color.parseColor("#F5F0E8")
            val accentColor   = if (params.isDark) Color.parseColor("#D4882A") else Color.parseColor("#A0540C")
            val textColor     = if (params.isDark) Color.parseColor("#EEE4D0") else Color.parseColor("#1E140A")
            val secondColor   = if (params.isDark) Color.parseColor("#C4A870") else Color.parseColor("#6B4F28")

            val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(bgColor)

            val pad = (36 * density).roundToInt()
            val inner = w - 2 * pad
            val topMargin = h * 0.10f
            val bottomMargin = h * 0.07f
            val availableH = h - topMargin - bottomMargin

            // The three (and only three) content blocks, in reading order.
            val blocks = mutableListOf<Block>()
            if (params.transliteration.isNotBlank()) {
                // Labelled with the verse number, e.g. "BG 2.13".
                val refLabel = params.reference.trim().uppercase().ifEmpty { "TRANSLITERATION" }
                blocks.add(Block(refLabel, params.transliteration.trim(), 17f, Layout.Alignment.ALIGN_CENTER, true, secondColor))
            }
            if (params.wordForWord.isNotBlank()) {
                val spanned = buildSynonyms(params.wordForWord.trim(), accentColor, textColor, secondColor)
                blocks.add(Block("WORD FOR WORD", spanned, 15f, Layout.Alignment.ALIGN_NORMAL, false, secondColor))
            }
            if (params.translation.isNotBlank()) {
                blocks.add(Block("TRANSLATION", params.translation.trim(), 21f, Layout.Alignment.ALIGN_NORMAL, false, textColor))
            }

            val labelGap = 8f * density
            val blockGap = 26f * density

            // Lay every block out at a given scale and report the total stack height.
            fun layoutAll(scale: Float): Pair<List<LaidOut>, Float> {
                val out = ArrayList<LaidOut>(blocks.size)
                var total = 0f
                for ((i, b) in blocks.withIndex()) {
                    val tp = TextPaint(Paint.ANTI_ALIAS_FLAG)
                    tp.color = b.color
                    tp.textSize = b.baseSp * scale * density
                    tp.typeface = if (b.italic)
                        Typeface.create(Typeface.SERIF, Typeface.ITALIC)
                    else
                        Typeface.create(Typeface.SERIF, Typeface.NORMAL)
                    val layout = buildStaticLayout(b.text, tp, inner, b.align)
                    val labelH = 11f * scale * density * 1.4f
                    out.add(LaidOut(b, labelH, layout))
                    total += labelH + labelGap + layout.height
                    if (i < blocks.size - 1) total += blockGap
                }
                return Pair(out, total)
            }

            // Shrink the font scale until the whole stack fits the available height.
            var scale = 1.0f
            var built = layoutAll(scale)
            while (built.second > availableH && scale > 0.35f) {
                scale *= 0.93f
                built = layoutAll(scale)
            }

            // Vertically center the fitted stack.
            var y = topMargin + max(0f, (availableH - built.second) / 2f)

            val labelPaint = TextPaint(Paint.ANTI_ALIAS_FLAG)
            labelPaint.color = accentColor
            labelPaint.typeface = Typeface.DEFAULT_BOLD
            labelPaint.letterSpacing = 0.22f

            for (lo in built.first) {
                // Section label.
                labelPaint.textSize = 11f * scale * density
                // The verse-reference label can be a long book title — shrink to fit one line.
                val labelW = labelPaint.measureText(lo.block.label)
                if (labelW > inner) labelPaint.textSize *= inner / labelW
                val labelX = if (lo.block.align == Layout.Alignment.ALIGN_CENTER)
                    (w - labelPaint.measureText(lo.block.label)) / 2f
                else
                    pad.toFloat()
                canvas.drawText(lo.block.label, labelX, y + 11f * scale * density, labelPaint)
                y += lo.labelHeight + labelGap

                // Body text.
                canvas.save()
                canvas.translate(pad.toFloat(), y)
                lo.layout.draw(canvas)
                canvas.restore()
                y += lo.layout.height + blockGap
            }

            // Set wallpaper on the requested surface(s).
            val wallpaperManager = WallpaperManager.getInstance(context)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val which = when (flag) {
                    "home" -> WallpaperManager.FLAG_SYSTEM
                    "lock" -> WallpaperManager.FLAG_LOCK
                    else   -> WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK
                }
                wallpaperManager.setBitmap(bitmap, null, true, which)
            } else {
                @Suppress("DEPRECATION")
                wallpaperManager.setBitmap(bitmap)
            }
        }
    }

    // Parses "word – meaning; word – meaning; …" and colors the Sanskrit words
    // with the accent color and the meanings with the body-text color so the two
    // read as distinct, matching the in-app word-for-word styling.
    private fun buildSynonyms(raw: String, wordColor: Int, meaningColor: Int, sepColor: Int): CharSequence {
        val sb = SpannableStringBuilder()
        val segments = raw.split(";").map { it.trim() }.filter { it.isNotEmpty() }
        for ((i, seg) in segments.withIndex()) {
            val m = Regex("^([\\s\\S]*?)\\s[–—-]\\s([\\s\\S]*)$").find(seg)
            if (m != null) {
                val word = m.groupValues[1].trim()
                val meaning = m.groupValues[2].trim()
                val ws = sb.length
                sb.append(word)
                sb.setSpan(ForegroundColorSpan(wordColor), ws, sb.length, 0)
                sb.setSpan(StyleSpan(android.graphics.Typeface.BOLD), ws, sb.length, 0)
                val ms = sb.length
                sb.append(" — ").append(meaning)
                sb.setSpan(ForegroundColorSpan(meaningColor), ms, sb.length, 0)
            } else {
                val ws = sb.length
                sb.append(seg)
                sb.setSpan(ForegroundColorSpan(wordColor), ws, sb.length, 0)
            }
            if (i < segments.size - 1) {
                val ss = sb.length
                sb.append(";  ")
                sb.setSpan(ForegroundColorSpan(sepColor), ss, sb.length, 0)
            }
        }
        return sb
    }

    private fun buildStaticLayout(
        text: CharSequence, tp: TextPaint, width: Int,
        align: Layout.Alignment
    ): StaticLayout {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            StaticLayout.Builder.obtain(text, 0, text.length, tp, width)
                .setAlignment(align)
                .setLineSpacing(4f, 1.12f)
                .setIncludePad(false)
                .build()
        } else {
            @Suppress("DEPRECATION")
            StaticLayout(text, tp, width, align, 1.12f, 4f, false)
        }
    }
}
