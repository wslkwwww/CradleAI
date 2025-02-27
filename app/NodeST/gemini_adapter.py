import requests
from typing import List, Dict, Any

class GeminiAdapter:
    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
    
    def __init__(self, api_key: str):
        """初始化 Gemini 客户端"""
        if not api_key:
            raise ValueError("API key cannot be empty")
        self.api_key = api_key
        self.model = "gemini-2.0-flash"
        self.headers = {
            "Content-Type": "application/json"
        }
        self.conversation_history = []
    
    def generate_content(self, contents: List[Dict[str, Any]]) -> str:
        """使用 generateContent 端点生成内容"""
        url = f"{self.BASE_URL}/models/{self.model}:generateContent?key={self.api_key}"
        
        # 构建请求数据，只包含必要字段
        data = {
            "contents": contents,  # contents已经在ChatManager中清理过
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 1024,
            }
        }
        
        try:
            response = requests.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            result = response.json()
            
            # 保存对话历史时也只保留必要字段
            if contents:
                self.conversation_history.extend([{
                    "role": msg.get("role", "user"),
                    "parts": msg.get("parts", [{"text": ""}])
                } for msg in contents])
            
            # 解析响应
            if result.get("candidates"):
                content = result["candidates"][0]["content"]
                response_text = content.get("parts", [{}])[0].get("text", "")
                # 保存AI响应到对话历史
                if response_text:
                    self.conversation_history.append({
                        "role": "assistant",
                        "parts": [{"text": response_text}]
                    })
                return response_text
            return ""
            
        except Exception as e:
            print(f"Error generating content: {e}")
            return str(e)
    
    def get_chat_history(self) -> List[Dict[str, str]]:
        """获取当前会话的聊天历史"""
        return [{
            "role": msg.get("role", "unknown"),
            "text": msg.get("parts", [{}])[0].get("text", "")
        } for msg in self.conversation_history]

