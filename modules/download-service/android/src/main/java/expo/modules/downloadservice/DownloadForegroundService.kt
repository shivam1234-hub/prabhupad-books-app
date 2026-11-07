package expo.modules.downloadservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

// Foreground service that exists only to keep the app process (and so the JS
// download queue) alive while books download: an ongoing progress
// notification, a partial wake lock so the CPU doesn't sleep mid-download, and
// a Wi-Fi lock so the radio doesn't drop to low power. The downloading itself
// stays in JS; this service never touches the network.
class DownloadForegroundService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP_REQUEST) {
      // "Stop" tapped on the notification — let JS cancel the queue; JS then
      // calls stop(), which stops this service.
      onStopRequested?.invoke()
      return START_NOT_STICKY
    }

    val notification = build(
      this,
      intent?.getStringExtra(EXTRA_TITLE) ?: "Downloading books",
      intent?.getStringExtra(EXTRA_TEXT) ?: "",
      intent?.getIntExtra(EXTRA_DONE, 0) ?: 0,
      intent?.getIntExtra(EXTRA_TOTAL, 0) ?: 0,
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    acquireLocks()
    // Not sticky: if the OS kills the process anyway there is no JS left to
    // drive the queue — the app resumes it on next launch instead.
    return START_NOT_STICKY
  }

  // Android 15 caps dataSync services at 6 h per day; stop cleanly when told.
  override fun onTimeout(startId: Int, fgsType: Int) {
    stopSelf()
  }

  override fun onDestroy() {
    releaseLocks()
    super.onDestroy()
  }

  private fun acquireLocks() {
    if (wakeLock == null) {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "vedabase:downloads").apply {
        setReferenceCounted(false)
        acquire(6 * 60 * 60 * 1000L) // safety net; released when the queue ends
      }
    }
    if (wifiLock == null) {
      val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      @Suppress("DEPRECATION")
      wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "vedabase:downloads").apply {
        setReferenceCounted(false)
        acquire()
      }
    }
  }

  private fun releaseLocks() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    wifiLock?.let { if (it.isHeld) it.release() }
    wifiLock = null
  }

  companion object {
    const val NOTIFICATION_ID = 7341
    const val CHANNEL_ID = "book-downloads"
    const val ACTION_STOP_REQUEST = "expo.modules.downloadservice.STOP_REQUEST"
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    const val EXTRA_DONE = "done"
    const val EXTRA_TOTAL = "total"

    // Set by the module so the notification's Stop action reaches JS.
    @Volatile var onStopRequested: (() -> Unit)? = null

    fun build(ctx: Context, title: String, text: String, done: Int, total: Int): Notification {
      ensureChannel(ctx)
      val open = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
        PendingIntent.getActivity(ctx, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      }
      val stop = PendingIntent.getService(
        ctx, 1,
        Intent(ctx, DownloadForegroundService::class.java).setAction(ACTION_STOP_REQUEST),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(ctx, CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION") Notification.Builder(ctx)
      }
      return builder
        .setSmallIcon(android.R.drawable.stat_sys_download)
        .setContentTitle(title)
        .setContentText(text)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setProgress(total, done.coerceAtMost(total), total <= 0)
        .setContentIntent(open)
        .addAction(Notification.Action.Builder(null, "Stop", stop).build())
        .build()
    }

    private fun ensureChannel(ctx: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL_ID) != null) return
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Book downloads", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Progress of offline book downloads"
          setShowBadge(false)
        }
      )
    }
  }
}
