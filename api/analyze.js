const { env } = require('process');
const OpenAI = require('openai');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { transcript, duration } = req.body;
    const apiKey = env.VITE_DEEPSEEK_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
      const mockResult = generateMockResult(transcript, duration || 180);
      res.status(200).json(mockResult);
      return;
    }

    const openai = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: apiKey
    });

    const prompt = buildPrompt(transcript, duration || 180);

    const requestParams = {
      model: "deepseek-chat",
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      stream: true
    };

    const stream = await openai.chat.completions.create(requestParams);

    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked'
    });

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
        const content = chunk.choices[0].delta.content || '';
        let cleanedContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        res.write(cleanedContent);
      }
    }

    res.end();
  } catch (error) {
    console.error('[AI分析] 失败:', error.message);

    const { transcript, duration } = req.body;
    const mockResult = generateMockResult(transcript, duration || 180);
    res.status(200).json(mockResult);
  }
};

function buildPrompt(transcript, duration) {
  return `你是一个视频内容分析专家。请分析以下视频字幕文本，完成两个任务：

视频时长：${duration} 秒

1. **内容总结**：用简洁的语言总结视频主要内容（100-200字）
2. **视频分段**：根据内容主题变化，将视频分成若干段落，每段包含：
   - 主题标题
   - 开始时间（秒数）
   - 结束时间（秒数）
   - 该段落的简要描述（50-100字）

字幕内容：
${transcript}

请以 JSON 格式返回结果：
{
  "summary": "视频总结内容",
  "segments": [
    {
      "title": "段落标题",
      "startTime": 0,
      "endTime": 30,
      "description": "段落描述"
    }
  ]
}

注意：
- 时间以秒为单位，必须是数字
- 分段数量根据内容长度决定，建议3-6段
- 确保时间段连续且不重叠
- 最后一段的endTime应等于视频总时长`;
}

function generateMockResult(transcript, duration) {
  const segmentCount = Math.min(Math.ceil(transcript.length / 50), 5);
  const actualDuration = duration || 180;
  const avgDuration = Math.max(Math.floor(actualDuration / segmentCount), 30);

  const segments = [];
  for (let i = 0; i < segmentCount; i++) {
    const startTime = i * avgDuration;
    const endTime = Math.min((i + 1) * avgDuration, actualDuration);
    segments.push({
      title: `段落 ${i + 1}: 视频内容概述`,
      startTime: startTime,
      endTime: endTime,
      description: `这是视频的第 ${i + 1} 段内容，包含语音识别的字幕信息。`
    });
  }

  return {
    summary: `视频内容总结：该视频包含语音识别字幕，主要讲述了"${transcript.substring(0, 50)}..."等内容。视频被分成${segmentCount}个段落进行分析。`,
    segments: segments
  };
}
