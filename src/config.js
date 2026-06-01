// 服务器地址配置
// 生产环境使用 /api（Vercel Serverless Functions），开发环境使用 localhost:3000
const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

let serverUrl = import.meta.env.VITE_SERVER_URL;
if (!serverUrl) {
  serverUrl = isProduction ? '' : 'http://localhost:3000';
}

export const SERVER_URL = serverUrl;

// 静态资源基础路径（视频、字幕等文件）
// 生产环境直接使用相对路径，开发环境需要代理到 localhost:3000
export const STATIC_BASE_URL = isProduction ? '' : 'http://localhost:3000';
