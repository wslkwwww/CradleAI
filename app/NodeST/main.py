import os
import logging
from typing import Optional, Literal, Dict
from fastapi import FastAPI, HTTPException, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import json
from chat_manager import ChatManager
from session_manager import SessionManager
from character_utils import build_r_framework, extract_d_entries

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = FastAPI(
    title="Character Chat API",
    description="A REST API for character chat based on Gemini model",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatResponse(BaseModel):
    """聊天响应模型"""
    message: str
    conversation_id: str

# 定义请求模型
class ChatRequest(BaseModel):
    """聊天请求模型"""
    role_card_json: Dict  # 改为直接接收Dict而不是str
    world_book_json: Dict
    preset_json: Dict
    author_note_json: Optional[Dict] = None  # 改为Optional[Dict]
    conversation_id: str
    user_message: str
    status: Literal["新建角色", "同一角色继续对话", "更新人设"]
    model_name: str = "gemini"
    api_key: str

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    处理聊天请求的端点

    参数:
    - role_card_json: 角色卡JSON字符串
    - world_book_json: 世界书JSON字符串
    - preset_json: 预设JSON字符串
    - author_note_json: 作者注释JSON字符串（可选）
    - conversation_id: 对话ID
    - user_message: 用户消息
    - status: 角色状态（"新建角色"/"同一角色继续对话"/"更新人设"）
    - model_name: 模型名称（默认为"gemini"）
    - api_key: API密钥

    返回:
    - message: AI的响应消息
    - conversation_id: 对话ID
    """
    try:
        # 直接使用请求中的JSON数据，不需要再解析
        role_card_data = request.role_card_json
        world_book_data = request.world_book_json
        preset_data = request.preset_json
        author_note_data = request.author_note_json  # 可能为None

        # 创建 ChatManager 和 SessionManager 实例
        chat_manager = ChatManager(request.api_key)
        session_manager = SessionManager()

        # 处理请求
        if request.status == "新建角色":
            session_manager.create_session(request.conversation_id)
        elif request.status == "更新人设":
            session_manager.clear_session(request.conversation_id)

        # 构建角色框架
        r_framework = build_r_framework(role_card_data, world_book_data, preset_data, author_note_data)
        d_entries = extract_d_entries(role_card_data)

        # 获取AI响应
        response = chat_manager.get_response(
            user_message=request.user_message,
            conversation_id=request.conversation_id,
            r_framework=r_framework,
            d_entries=d_entries
        )

        if response is None:
            raise HTTPException(status_code=500, detail="Failed to process request")

        return ChatResponse(
            message=response,
            conversation_id=request.conversation_id
        )

    except KeyError as e:
        logging.exception("缺少JSON字段")
        raise HTTPException(status_code=400, detail=f"JSON 数据缺少必需的字段: {e}")
    except ValueError as e:
        logging.exception("JSON字段的值无效")
        raise HTTPException(status_code=400, detail=f"JSON 数据的值无效: {e}")
    except Exception as e:
        logging.exception("发生未知错误")
        raise HTTPException(status_code=500, detail=f"发生未知错误: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=39001)