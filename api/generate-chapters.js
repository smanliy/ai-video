const { env } = require('process');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { fileId, transcript, duration } = req.body;

    if (!fileId || !transcript) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const apiKey = env.VITE_DEEPSEEK_API_KEY;
    let analysisResult;

    if (!apiKey || apiKey.trim() === '') {
      analysisResult = generateMockResult(transcript, duration || 180);
    } else {
      const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey
      });

      const prompt = buildPrompt(transcript, duration || 180);
      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      });

      const content = response.choices[0].message.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        analysisResult = generateMockResult(transcript, duration || 180);
      }
    }

    // 生成 VTT 内容
    const vttContent = generateChapterVTT(analysisResult);

    // 在 Vercel Serverless 环境中，临时目录是 /tmp
    const chapterDir = path.join('/tmp', 'uploads', 'videos', 'transcription', fileId, 'chapter');
    if (!fs.existsSync(chapterDir)) {
      fs.mkdirSync(chapterDir, { recursive: true });
    }

    const vttFileName = `${fileId}_chapters.vtt`;
    const vttPath = path.join(chapterDir, vttFileName);
    fs.writeFileSync(vttPath, vttContent, 'utf8');

    const vttUrlPath = `/uploads/videos/transcription/${fileId}/chapter/${vttFileName}`;

    res.json({
      success: true,
      chapterVttPath: vttUrlPath,
      summary: analysisResult.summary || '',
      segments: analysisResult.segments || []
    });

  } catch (error) {
    console.error('[章节生成] 失败:', error.message);

    const { transcript, duration } = req.body;
    const mockResult = generateMockResult(transcript, duration || 180);

    res.json({
      success: true,
      chapterVttPath: `/uploads/videos/transcription/mock_chapters.vtt`,
      summary: mockResult.summary || '',
      segments: mockResult.segments || []
    });
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

function generateChapterVTT(analysisResult) {
  const { segments } = analysisResult;
  if (!segments || segments.length === 0) {
    return `WEBVTT

00:00:00.000 --> 00:03:00.000
视频内容概述
`;
  }

  let vttContent = 'WEBVTT\n\n';
  
  for (const segment of segments) {
    const startTime = formatTime(segment.startTime);
    const endTime = formatTime(segment.endTime);
    vttContent += `${startTime} --> ${endTime}\n${segment.title}\n\n`;
  }

  return vttContent;
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
