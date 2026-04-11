package kr.cashwalk.stockmap;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
  name = "StepTracker",
  permissions = {
    @Permission(
      alias = "activityRecognition",
      strings = { Manifest.permission.ACTIVITY_RECOGNITION }
    ),
    @Permission(
      alias = "notifications",
      strings = { Manifest.permission.POST_NOTIFICATIONS }
    )
  }
)
public class StepTrackerPlugin extends Plugin {
  private static final String PREF_NAME = "step_tracking_prefs";
  private static final String KEY_STEPS = "steps";
  private static final String KEY_GOAL = "goal";
  private static final String KEY_CASH_PER_STEP = "cash_per_step";

  @PluginMethod
  public void requestAllPermissions(PluginCall call) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      requestPermissionForAliases(new String[] { "activityRecognition", "notifications" }, call, "permissionsCallback");
    } else {
      requestPermissionForAlias("activityRecognition", call, "permissionsCallback");
    }
  }

  @PluginMethod
  public void start(PluginCall call) {
    Context context = getContext();
    SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);

    int goal = call.getInt("goal", prefs.getInt(KEY_GOAL, 5000));
    double cashPerStep = call.getDouble("cashPerStep", (double) prefs.getFloat(KEY_CASH_PER_STEP, 0.5f));
    Integer steps = call.getInt("steps");

    SharedPreferences.Editor editor = prefs.edit();
    editor.putInt(KEY_GOAL, goal);
    editor.putFloat(KEY_CASH_PER_STEP, (float) cashPerStep);
    if (steps != null) {
      editor.putInt(KEY_STEPS, steps);
    }
    editor.apply();

    Intent intent = new Intent(context, StepTrackingService.class);
    intent.setAction(StepTrackingService.ACTION_START);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent);
    } else {
      context.startService(intent);
    }

    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void stop(PluginCall call) {
    Context context = getContext();
    Intent intent = new Intent(context, StepTrackingService.class);
    intent.setAction(StepTrackingService.ACTION_STOP);
    context.startService(intent);
    call.resolve();
  }

  @PluginMethod
  public void getStats(PluginCall call) {
    SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    int steps = prefs.getInt(KEY_STEPS, 3247);
    int goal = prefs.getInt(KEY_GOAL, 5000);
    float cashPerStep = prefs.getFloat(KEY_CASH_PER_STEP, 0.5f);
    double cash = steps * cashPerStep;

    JSObject ret = new JSObject();
    ret.put("steps", steps);
    ret.put("goal", goal);
    ret.put("cashPerStep", cashPerStep);
    ret.put("cash", cash);
    call.resolve(ret);
  }

  private void permissionsCallback(PluginCall call) {
    if (getPermissionState("activityRecognition") != com.getcapacitor.PermissionState.GRANTED) {
      call.reject("ACTIVITY_RECOGNITION 권한이 필요합니다.");
      return;
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
      && getPermissionState("notifications") != com.getcapacitor.PermissionState.GRANTED) {
      call.reject("알림 권한이 필요합니다.");
      return;
    }
    call.resolve();
  }
}
