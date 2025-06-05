# 保守的 ProGuard 配置 - 用于调试闪退问题
# 如果主配置导致问题，可以在工作流中使用此配置

# 保留所有公共 API
-keepclasseswithmembernames class * {
    native <methods>;
}

# 保留所有枚举
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# 保留 Parcelable 实现
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# 保留 Serializable 类
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# React Native 核心
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-dontwarn com.facebook.jni.**

# Expo
-keep class expo.** { *; }
-keep class versioned.host.exp.exponent.** { *; }
-dontwarn expo.**
-dontwarn versioned.host.exp.exponent.**

# 保留所有原生模块
-keep class * implements com.facebook.react.bridge.NativeModule { *; }
-keep class * implements com.facebook.react.turbomodule.core.TurboModule { *; }
-keep class * implements com.facebook.react.bridge.JavaScriptModule { *; }

# Matrix SDK - 完全保留
-keep class org.matrix.** { *; }
-keep class matrix.** { *; }
-dontwarn org.matrix.**
-dontwarn matrix.**

# Node.js polyfills - 完全保留
-keep class com.peel.** { *; }
-keep class com.tradle.** { *; }
-keep class stream.** { *; }
-keep class crypto.** { *; }
-keep class buffer.** { *; }
-keep class events.** { *; }
-keep class util.** { *; }
-keep class url.** { *; }
-keep class querystring.** { *; }
-dontwarn com.peel.**
-dontwarn com.tradle.**
-dontwarn stream.**
-dontwarn crypto.**
-dontwarn buffer.**
-dontwarn events.**
-dontwarn util.**
-dontwarn url.**
-dontwarn querystring.**

# 保留所有社区包
-keep class com.reactnativecommunity.** { *; }
-keep class org.reactnative.** { *; }
-dontwarn com.reactnativecommunity.**
-dontwarn org.reactnative.**

# SQLite
-keep class org.sqlite.** { *; }
-keep class io.expo.sqlite.** { *; }
-dontwarn org.sqlite.**
-dontwarn io.expo.sqlite.**

# 网络相关
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# WebView
-keep class com.reactnativecommunity.webview.** { *; }
-dontwarn com.reactnativecommunity.webview.**

# Video
-keep class com.brentvatne.** { *; }
-dontwarn com.brentvatne.**

# 保留注解
-keep @interface androidx.annotation.Keep
-keep @androidx.annotation.Keep class *
-keepclassmembers class * {
    @androidx.annotation.Keep *;
}

# JavaScript 接口
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# React Native 特定
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}
-keepclassmembers class * {
    void *(**On*Event)(com.facebook.react.bridge.WritableMap);
}

# 保留应用程序入口点
-keep class * extends android.app.Application
-keep class * extends android.app.Activity
-keep class * extends android.app.Service
-keep class * extends android.content.BroadcastReceiver
-keep class * extends android.content.ContentProvider

# 仅移除日志，其他都保留
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}

# 保留异常和堆栈跟踪
-keepattributes SourceFile,LineNumberTable,*Annotation*,EnclosingMethod,Signature,Exceptions,InnerClasses 