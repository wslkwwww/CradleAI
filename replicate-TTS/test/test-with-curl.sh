#!/bin/bash

# Replicate TTS API 测试脚本
# 使用 curl 发送测试请求

# 配置
API_URL="http://localhost:3002/api/tts"
TEMPLATE_ID="template1"
TTS_TEXT="这是一段要转换为语音的示例文本。"

echo "======= Replicate TTS API 测试 (使用 curl) ======="
echo "发送请求到: $API_URL"
echo "请求参数: templateId=$TEMPLATE_ID, tts_text=$TTS_TEXT"

# 构建 JSON 请求数据
REQUEST_DATA="{\"templateId\":\"$TEMPLATE_ID\",\"tts_text\":\"$TTS_TEXT\"}"

echo "发送请求..."
START_TIME=$(date +%s)

# 发送 curl 请求
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d "$REQUEST_DATA" > response.json

END_TIME=$(date +%s)
ELAPSED_TIME=$((END_TIME - START_TIME))

echo "请求完成! 耗时: $ELAPSED_TIME 秒"

# 解析响应
if grep -q "success\":true" response.json; then
  echo "✅ 请求成功!"
  echo "响应内容:"
  cat response.json | jq
else
  echo "❌ 请求失败:"
  cat response.json | jq
fi

echo "响应已保存到 response.json"
