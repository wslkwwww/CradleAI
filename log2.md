 LOG  [first_mes] [messages effect] getMessages(1748334706122)已有3条消息，不发送first_mes
 LOG  [StorageAdapter] Retrieved 3 clean messages
 LOG  [TableMemory] 获取所有模板，共 6 个模板
 LOG  [TableMemory] 已存在模板，跳过创建默认模板
 LOG  [TableMemory] 插件初始化完成
 LOG  [TableMemory] 插件已启用
 LOG  [TableMemoryIntegration] 表格记忆插件初始化成功
 LOG  [ChatDialog] Checking audio for 2 new messages
 LOG  [AudioCacheManager] Initialized audio states for 2 messages
 LOG  [AudioCacheManager] Updated audio state for 1748334706122_1748605700243_jvemat: {"error": null, "hasAudio": false, "isComplete": false, "isLoading": true, "isPlaying": false}
 LOG  [synthesizeWithCosyVoice] Input parameters: {"initialSourceAudio": undefined, "initialSourceTranscript": undefined, "options": undefined, "task": undefined, "templateIdOrSourceAudio": "template1a", "text": "最 
近有什么新鲜事吗"}
 LOG  [synthesizeWithCosyVoice] Generated source_audio URL: https://cradleintro.top/template1a/source_audio.mp3
 LOG  [synthesizeWithCosyVoice] Fetching transcript from: https://cradleintro.top/template1a/source_transcript.txt
 LOG  [fetchTranscriptText] Fetching from URL: https://cradleintro.top/template1a/source_transcript.txt     
 LOG  [fetchTranscriptText] Response status: 200 
 LOG  [fetchTranscriptText] Successfully fetched transcript length: 45
 LOG  [fetchTranscriptText] Transcript content preview: 对我大献殷勤又不求回报...俗话说，没有什么比免费的东 
西更昂贵。你想要的东西，确实很昂费。...
 LOG  [synthesizeWithCosyVoice] Fetched transcript: 对我大献殷勤又不求回报...俗话说，没有什么比免费的东西更 
昂贵。你想要的东西，确实很昂费。
 LOG  [synthesizeWithCosyVoice] Final parameters before request: {"hasSourceAudio": true, "hasSourceTranscript": true, "source_audio": "https://cradleintro.top/template1a/source_audio.mp3", "source_transcript": "对我
大献殷勤又不求回报...俗话说，没有什么比免费的东西更昂贵。你想要的东西，确实很昂费。"}
 LOG  [synthesizeWithCosyVoice] 最终请求数据: {"preferredProvider": "cosyvoice", "providerSpecific": {"source_audio": "https://cradleintro.top/template1a/source_audio.mp3", "source_transcript": "对我大献殷勤又不求回 
报...俗话说，没有什么比免费的东西更昂贵。你想要的东西，确实很昂费。", "task": undefined}, "text": "最近有什 
么新鲜事吗"}
 LOG  [synthesizeText] Available providers: ["cosyvoice", "doubao", "minimax"]
 LOG  [synthesizeText] Preferred provider: cosyvoice
 LOG  [synthesizeText] Selected provider: cosyvoice
 LOG  [synthesizeText] Preferred provider available: true
 LOG  [CosyVoiceAdapter] Synthesize - Current token available: true
 LOG  [CosyVoiceAdapter] Synthesize - Token sources: {"envToken": false, "minimaxApiToken": true, "replicateApiToken": true}
 LOG  [CosyVoiceAdapter] Input parameters: {"hasSourceAudio": true, "hasSourceTranscript": true, "source_audio": "https://cradleintro.top/template1a/source_audio.mp3", "source_transcript": "对我大献殷勤又不求回报... 
俗话说，没有什么比免费的东西更昂贵。你想要的东西，确实很昂费。", "task": undefined, "text": "最近有什么新鲜 
事吗"}
 LOG  [CosyVoiceAdapter] Final request to Replicate: {"hasToken": true, "input": {"source_audio": "https://cradleintro.top/template1a/source_audio.mp3", "source_transcript": "对我大献殷勤又不求回报...俗话说，没有什么
比免费的东西更昂贵。你想要的东西，确实很昂费。", "task": "zero-shot voice clone", "tts_text": "最近有什么新 
鲜事吗"}, "model": "chenxwh/cosyvoice2-0.5b:669b1cd618f2747d2237350e868f5c313f3b548fc803ca4e57adfaba778b042d"}
 LOG  [CosyVoiceAdapter] Received audio URL: "https://replicate.delivery/xezq/KGdndmAK9XLXEZAUFh2nFajwXbgCY8U0tKcSvOyGFBqYNdMF/out.wav"
 LOG  [CosyVoiceAdapter] saveAudioFile - Input audioUrl: "https://replicate.delivery/xezq/KGdndmAK9XLXEZAUFh2nFajwXbgCY8U0tKcSvOyGFBqYNdMF/out.wav"
 ERROR  [CosyVoiceAdapter] Error downloading audio file: [TypeError: audioUrl.startsWith is not a function (it is undefined)]
 LOG  [CosyVoiceAdapter] Trying alternative download method...
 ERROR  [CosyVoiceAdapter] Alternative download method also failed: [RangeError: Maximum call stack size exceeded (native stack depth)]
 LOG  [CosyVoiceAdapter] Falling back to direct URL streaming
 LOG  [CosyVoiceAdapter] Final audioPath: "https://replicate.delivery/xezq/KGdndmAK9XLXEZAUFh2nFajwXbgCY8U0tKcSvOyGFBqYNdMF/out.wav"
 ERROR  [AudioCacheManager] Failed to cache audio file: [Error: Call to function 'ExponentFileSystem.copyAsync' has been rejected.
→ Caused by: The 1st argument cannot be cast to type expo.modules.filesystem.RelocatingOptions (received class com.facebook.react.bridge.ReadableNativeMap)
→ Caused by: Cannot cast 'Map' for field 'from' ('kotlin.String').
→ Caused by: com.facebook.react.bridge.UnexpectedNativeTypeException: Value for from cannot be cast from ReadableNativeMap to String]
 ERROR  [ChatDialog] Failed to cache audio: [Error: Call to function 'ExponentFileSystem.copyAsync' has been rejected.
→ Caused by: The 1st argument cannot be cast to type expo.modules.filesystem.RelocatingOptions (received class com.facebook.react.bridge.ReadableNativeMap)
→ Caused by: Cannot cast 'Map' for field 'from' ('kotlin.String').
→ Caused by: com.facebook.react.bridge.UnexpectedNativeTypeException: Value for from cannot be cast from ReadableNativeMap to String]
 LOG  [AudioCacheManager] Updated audio state for 1748334706122_1748605700243_jvemat: {"error": "Failed to cache audio", "hasAudio": false, "isComplete": false, "isLoading": false, "isPlaying": false}