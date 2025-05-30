# Minimax T2A Large v2 语音合成API文档

## 概述

T2A Large v2 API 支持异步文本转语音生成，单次请求最大支持100万字符的文本输入。音频结果可通过异步方式获取。

### 主要功能特性

1. **丰富的语音选择**：支持100+系统语音和自定义语音克隆选项
2. **灵活的音频控制**：支持调节音调、语速、音量、比特率、采样率和输出格式
3. **详细的音频信息**：返回音频时长、音频大小等参数
4. **时间戳支持**：支持返回时间戳（字幕），精确到句子级别
5. **多种输入方式**：支持直接字符串输入和通过file_id上传文本文件
6. **智能字符检测**：自动检测无效字符，无效字符不超过10%时正常生成音频

### 适用场景
长文本语音生成，如整本书籍的语音合成。

## 支持的模型

| 模型名称 | 描述 |
|---------|------|
| `speech-02-hd` | 全新HD模型，拥有出色的节奏和稳定性，在复制相似度和音质方面表现突出 |
| `speech-02-turbo` | 全新Turbo模型，拥有出色的节奏和稳定性，增强的多语言能力和卓越性能 |
| `speech-01-hd` | 丰富的声音，富有表现力的情感，地道的语言 |
| `speech-01-turbo` | 最新模型，提供卓越性能和低延迟，定期更新 |

## API使用流程

### 整体流程
1. 创建语音生成任务，获取 `task_id`（如使用文件输入，需先通过 File(Upload) 接口上传文件）
2. 根据 `task_id` 查询语音生成任务状态
3. 任务成功生成后，使用返回的 `file_id` 通过 File API 查看和下载结果

⚠️ **重要提醒**：返回的URL仅在生成后9小时（32400秒）内有效，过期后URL失效，生成信息将丢失。

## API接口详情

### 1. 创建语音生成任务

**接口地址**：`https://api.minimaxi.chat/v1/t2a_async_v2`  
**请求方法**：POST

#### 请求头参数
| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | API密钥，格式：`Bearer {API_KEY}` |
| Content-Type | string | 是 | `application/json` |

#### URL参数
| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| GroupId | string | 是 | 您的group_id |

#### 请求体参数
| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| model | string | 是 | 模型名称：`speech-02-hd`、`speech-02-turbo`、`speech-01-hd`、`speech-01-turbo` |
| text | string | 二选一 | 要合成的文本，字符限制 < 50000字符 |
| text_file_id | int64 | 二选一 | 要合成的文本文件ID |
| voice_setting | object | 是 | 语音设置参数 |
| audio_setting | object | 是 | 音频设置参数 |
| pronunciation_dict | object | 否 | 发音词典设置 |
| language_boost | string | 否 | 语言增强设置 |

#### voice_setting 参数说明
| 参数名 | 类型 | 描述 |
|--------|------|------|
| voice_id | string | 语音ID，如：`Wise_Woman` |
| speed | float | 语速，默认1.0 |
| vol | float | 音量，默认1.0 |
| pitch | float | 音调，默认1.0 |
| emotion | string | 情感，如：`happy` |
| english_normalization | boolean | 英文标准化 |

#### audio_setting 参数说明
| 参数名 | 类型 | 描述 |
|--------|------|------|
| audio_sample_rate | int | 采样率，如：32000 |
| bitrate | int | 比特率，如：128000 |
| format | string | 输出格式，如：`mp3` |
| channel | int | 声道数，默认1 |

#### 代码示例

**使用文本字符串输入：**

```python
import requests
import json

# 配置参数
group_id = "你的group_id"
api_key = "你的API密钥"

url = f"https://api.minimaxi.chat/v1/t2a_async_v2?GroupId={group_id}"

payload = json.dumps({
    "model": "speech-02-hd",
    "text": "要合成语音的文本内容。",
    "voice_setting": {
        "voice_id": "Wise_Woman",
        "speed": 1,
        "vol": 1,
        "pitch": 1,
        "emotion": "happy",
        "english_normalization": True
    },
    "pronunciation_dict": {
        "tone": [
            "omg/oh my god"
        ]
    },
    "audio_setting": {
        "audio_sample_rate": 32000,
        "bitrate": 128000,
        "format": "mp3",
        "channel": 1
    }
})

headers = {
    'authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}

response = requests.post(url, headers=headers, data=payload)
print(response.text)
```

#### 响应参数
| 参数名 | 类型 | 描述 |
|--------|------|------|
| task_id | string | 任务ID |
| task_token | string | 任务密钥 |
| file_id | int64 | 文件ID，任务完成后用于下载结果 |
| base_resp | object | 响应状态信息 |

**响应示例：**
```json
{
    "task_id": "95157322514444",
    "task_token": "eyJhbGciOiJSUz",
    "file_id": 95157322514444,
    "base_resp": {
        "status_code": 0,
        "status_msg": "success"
    }
}
```

### 2. 查询语音生成任务状态

**接口地址**：`https://api.minimaxi.chat/v1/query/t2a_async_query_v2`  
**请求方法**：GET  
**频率限制**：每秒最多10次查询

#### URL参数
| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| GroupId | string | 是 | 您的group_id |
| task_id | string | 是 | 任务ID |

#### 请求头参数
| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | API密钥，格式：`Bearer {API_KEY}` |
| Content-Type | string | 是 | `application/json` |

#### 代码示例

```python
import requests

# 配置参数
group_id = "你的group_id"
api_key = "你的API密钥"
task_id = "任务ID"

url = f"https://api.minimaxi.chat/v1/query/t2a_async_query_v2?GroupId={group_id}&task_id={task_id}"

headers = {
    'authorization': f'Bearer {api_key}',
    'content-type': 'application/json',
}

response = requests.get(url, headers=headers)
print(response.text)
```

#### 响应参数
| 参数名 | 类型 | 描述 |
|--------|------|------|
| task_id | int | 任务ID |
| status | string | 任务状态：`Processing`（处理中）、`Success`（成功）、`Failed`（失败）、`Expired`（过期） |
| file_id | int64 | 文件ID |
| base_resp | object | 响应状态信息 |

**响应示例：**
```json
{
    "task_id": 95157322514444,
    "status": "Success",
    "file_id": 95157322514496,
    "base_resp": {
        "status_code": 0,
        "status_msg": "success"
    }
}
```

### 3. 获取音频文件下载链接

**接口地址**：`https://api.minimaxi.chat/v1/files/retrieve`  
**请求方法**：GET

#### URL参数
| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| GroupId | string | 是 | 您的group_id |
| file_id | string | 是 | 文件ID |

#### 请求头参数
| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| Authorization | string | 是 | API密钥，格式：`Bearer {API_KEY}` |
| Content-Type | string | 是 | `application/json` |

#### 代码示例

```python
import requests

# 配置参数
group_id = "你的group_id"
api_key = "你的API密钥"
file_id = "文件ID"

url = f'https://api.minimaxi.chat/v1/files/retrieve?GroupId={group_id}&file_id={file_id}'
headers = {
    'authority': 'api.minimaxi.chat',
    'content-type': 'application/json',
    'Authorization': f'Bearer {api_key}'
}

response = requests.get(url, headers=headers)
print(response.text)
```

#### 响应参数
| 参数名 | 类型 | 描述 |
|--------|------|------|
| file_id | int64 | 文件ID |
| bytes | int64 | 文件大小 |
| created_at | int64 | 文件创建时间戳（秒） |
| filename | string | 文件名 |
| purpose | string | 文件用途 |
| download_url | string | 音频文件下载链接 |
| base_resp | object | 状态码和详细信息 |

## 完整使用示例

```python
import requests
import json
import time

class MinimaxTTSClient:
    def __init__(self, api_key, group_id):
        self.api_key = api_key
        self.group_id = group_id
        self.base_url = "https://api.minimaxi.chat"
        
    def create_speech_task(self, text, voice_settings=None, audio_settings=None):
        """创建语音生成任务"""
        url = f"{self.base_url}/v1/t2a_async_v2?GroupId={self.group_id}"
        
        # 默认配置
        default_voice_settings = {
            "voice_id": "Wise_Woman",
            "speed": 1,
            "vol": 1,
            "pitch": 1,
            "emotion": "happy",
            "english_normalization": True
        }
        
        default_audio_settings = {
            "audio_sample_rate": 32000,
            "bitrate": 128000,
            "format": "mp3",
            "channel": 1
        }
        
        payload = {
            "model": "speech-02-hd",
            "text": text,
            "voice_setting": voice_settings or default_voice_settings,
            "audio_setting": audio_settings or default_audio_settings
        }
        
        headers = {
            'authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        response = requests.post(url, headers=headers, json=payload)
        return response.json()
    
    def query_task_status(self, task_id):
        """查询任务状态"""
        url = f"{self.base_url}/v1/query/t2a_async_query_v2?GroupId={self.group_id}&task_id={task_id}"
        
        headers = {
            'authorization': f'Bearer {self.api_key}',
            'content-type': 'application/json',
        }
        
        response = requests.get(url, headers=headers)
        return response.json()
    
    def get_file_info(self, file_id):
        """获取文件信息和下载链接"""
        url = f"{self.base_url}/v1/files/retrieve?GroupId={self.group_id}&file_id={file_id}"
        
        headers = {
            'authorization': f'Bearer {self.api_key}',
            'content-type': 'application/json',
        }
        
        response = requests.get(url, headers=headers)
        return response.json()
    
    def generate_speech(self, text, max_wait_time=300):
        """完整的语音生成流程"""
        print("正在创建语音生成任务...")
        
        # 创建任务
        task_result = self.create_speech_task(text)
        if task_result.get('base_resp', {}).get('status_code') != 0:
            print(f"任务创建失败: {task_result}")
            return None
            
        task_id = task_result['task_id']
        print(f"任务创建成功，任务ID: {task_id}")
        
        # 轮询任务状态
        start_time = time.time()
        while time.time() - start_time < max_wait_time:
            status_result = self.query_task_status(task_id)
            status = status_result.get('status')
            
            print(f"任务状态: {status}")
            
            if status == 'Success':
                file_id = status_result.get('file_id')
                print(f"任务完成，文件ID: {file_id}")
                
                # 获取下载链接
                file_info = self.get_file_info(file_id)
                download_url = file_info.get('download_url')
                
                if download_url:
                    print(f"下载链接: {download_url}")
                    return download_url
                else:
                    print("获取下载链接失败")
                    return None
                    
            elif status == 'Failed':
                print("任务失败")
                return None
            elif status == 'Expired':
                print("任务过期")
                return None
            
            time.sleep(5)  # 等待5秒后再次查询
        
        print("任务超时")
        return None

# 使用示例
if __name__ == "__main__":
    api_key = "你的API密钥"
    group_id = "你的group_id"
    
    client = MinimaxTTSClient(api_key, group_id)
    
    text = "这是一段需要转换为语音的文本内容。"
    download_url = client.generate_speech(text)
    
    if download_url:
        print(f"语音生成成功！下载链接：{download_url}")
        print("请在9小时内下载文件，链接将在9小时后失效。")
    else:
        print("语音生成失败")
```

## 注意事项

1. **文件有效期**：生成的下载链接仅在9小时内有效，请及时下载
2. **字符限制**：单次文本输入限制50000字符，文件输入限制100000字符
3. **查询频率**：状态查询接口每秒最多10次
4. **无效字符**：系统会自动检测ASCII控制字符（制表符和换行符除外），超过10%时将返回错误
5. **暂停控制**：在文本中插入 `<#x#>` 可控制语音暂停时间，x为秒数（0.01-99.99s）

## 错误码说明

| 状态码 | 描述 |
|--------|------|
| 0 | 成功 |
| 其他 | 具体错误信息请查看 base_resp.status_msg |

通过以上API，您可以轻松实现长文本到语音的转换，满足各种语音合成需求。