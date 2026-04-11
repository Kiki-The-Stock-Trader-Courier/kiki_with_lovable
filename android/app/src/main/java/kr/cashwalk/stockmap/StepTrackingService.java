package kr.cashwalk.stockmap;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import java.text.DecimalFormat;

public class StepTrackingService extends Service implements SensorEventListener {
  public static final String ACTION_START = "kr.cashwalk.stockmap.action.START";
  public static final String ACTION_STOP = "kr.cashwalk.stockmap.action.STOP";

  private static final String CHANNEL_ID = "step_tracking_channel";
  private static final int NOTIFICATION_ID = 1101;
  private static final String PREF_NAME = "step_tracking_prefs";
  private static final String KEY_STEPS = "steps";
  private static final String KEY_GOAL = "goal";
  private static final String KEY_CASH_PER_STEP = "cash_per_step";

  private SensorManager sensorManager;
  private Sensor stepDetectorSensor;
  private SharedPreferences prefs;

  @Override
  public void onCreate() {
    super.onCreate();
    prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
    if (sensorManager != null) {
      stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
    }
    ensureDefaultValues();
    createNotificationChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent != null ? intent.getAction() : null;
    if (ACTION_STOP.equals(action)) {
      stopSelf();
      return START_NOT_STICKY;
    }

    startForeground(NOTIFICATION_ID, buildNotification());
    registerSensor();
    return START_STICKY;
  }

  private void ensureDefaultValues() {
    if (!prefs.contains(KEY_GOAL)) {
      prefs.edit().putInt(KEY_GOAL, 5000).apply();
    }
    if (!prefs.contains(KEY_CASH_PER_STEP)) {
      prefs.edit().putFloat(KEY_CASH_PER_STEP, 0.5f).apply();
    }
    if (!prefs.contains(KEY_STEPS)) {
      prefs.edit().putInt(KEY_STEPS, 3247).apply();
    }
  }

  private void registerSensor() {
    if (sensorManager != null && stepDetectorSensor != null) {
      sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_NORMAL);
    }
  }

  private Notification buildNotification() {
    int steps = prefs.getInt(KEY_STEPS, 3247);
    int goal = prefs.getInt(KEY_GOAL, 5000);
    float cashPerStep = prefs.getFloat(KEY_CASH_PER_STEP, 0.5f);
    long cash = Math.round(steps * cashPerStep);
    String content = "오늘 걸음 " + formatNumber(steps) + "/" + formatNumber(goal) + "  캐시 " + formatNumber((int) cash) + "원";

    Intent openAppIntent = new Intent(this, MainActivity.class);
    openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pendingIntent = PendingIntent.getActivity(
      this,
      0,
      openAppIntent,
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT
    );

    return new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("걸음수 카운터")
      .setContentText(content)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(content))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(pendingIntent)
      .build();
  }

  private void updateNotification() {
    NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager != null) {
      manager.notify(NOTIFICATION_ID, buildNotification());
    }
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        "걸음수 추적",
        NotificationManager.IMPORTANCE_LOW
      );
      channel.setDescription("백그라운드 걸음수 추적 알림");
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager != null) manager.createNotificationChannel(channel);
    }
  }

  private String formatNumber(int value) {
    return new DecimalFormat("#,###").format(value);
  }

  @Override
  public void onSensorChanged(SensorEvent event) {
    if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
      int added = Math.round(event.values[0]);
      int current = prefs.getInt(KEY_STEPS, 3247);
      prefs.edit().putInt(KEY_STEPS, current + Math.max(1, added)).apply();
      updateNotification();
    }
  }

  @Override
  public void onAccuracyChanged(Sensor sensor, int accuracy) {
    // no-op
  }

  @Override
  public void onDestroy() {
    if (sensorManager != null) {
      sensorManager.unregisterListener(this);
    }
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
