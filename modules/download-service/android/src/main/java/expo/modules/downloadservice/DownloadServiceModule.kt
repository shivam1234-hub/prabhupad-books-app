package expo.modules.downloadservice

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// JS controls for DownloadForegroundService. Besides the service, start() opens
// a React Native headless JS task: while one is active RN keeps JS timers
// running in the background (they otherwise freeze when the app leaves the
// screen), so retries / timeouts in the download code keep working.
class DownloadServiceModule : Module() {
  private var keepAliveTaskId = -1
  private var running = false

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No React context")

  override fun definition() = ModuleDefinition {
    Name("DownloadService")
    Events("onStopRequested")

    OnCreate {
      DownloadForegroundService.onStopRequested = { sendEvent("onStopRequested", emptyMap<String, Any>()) }
    }

    OnDestroy {
      DownloadForegroundService.onStopRequested = null
    }

    Function("start") { title: String, text: String ->
      val intent = Intent(context, DownloadForegroundService::class.java)
        .putExtra(DownloadForegroundService.EXTRA_TITLE, title)
        .putExtra(DownloadForegroundService.EXTRA_TEXT, text)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      running = true
      startKeepAlive()
    }

    Function("update") { title: String, text: String, done: Int, total: Int ->
      if (!running) return@Function
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(
        DownloadForegroundService.NOTIFICATION_ID,
        DownloadForegroundService.build(context, title, text, done, total),
      )
    }

    Function("stop") {
      running = false
      context.stopService(Intent(context, DownloadForegroundService::class.java))
      finishKeepAlive()
    }
  }

  private fun startKeepAlive() {
    val rc = appContext.reactContext as? ReactContext ?: return
    UiThreadUtil.runOnUiThread {
      val tasks = HeadlessJsTaskContext.getInstance(rc)
      if (keepAliveTaskId >= 0 && tasks.isTaskRunning(keepAliveTaskId)) return@runOnUiThread
      keepAliveTaskId = tasks.startTask(
        // No timeout, allowed while the app is on screen too.
        HeadlessJsTaskConfig(KEEP_ALIVE_TASK, Arguments.createMap(), 0, true)
      )
    }
  }

  private fun finishKeepAlive() {
    val rc = appContext.reactContext as? ReactContext ?: return
    val id = keepAliveTaskId
    keepAliveTaskId = -1
    if (id >= 0) UiThreadUtil.runOnUiThread { HeadlessJsTaskContext.getInstance(rc).finishTask(id) }
  }

  companion object {
    // Must match the name registered with AppRegistry.registerHeadlessTask in JS.
    const val KEEP_ALIVE_TASK = "VedabaseDownloadKeepAlive"
  }
}
