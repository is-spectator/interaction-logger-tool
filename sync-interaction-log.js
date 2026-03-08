#!/usr/bin/env node
/**
 * 交互日志同步工具
 * 
 * 从 OpenClaw 会话历史中提取消息，同步到交互日志平台
 * 
 * 使用方式：
 *   node sync-interaction-log.js              # 手动运行一次
 *   node sync-interaction-log.js --daemon     # 守护进程模式
 *   node sync-interaction-log.js --debug      # 调试模式
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ==================== 配置 ====================
const CONFIG_PATH = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = {
  // 交互日志平台配置
  api_base: "http://localhost:8505",
  bot_token: "token_xiaoxia_001",
  bot_name: "小虾虾",
  platform: "openclaw",
  
  // OpenClaw 会话目录
  sessions_dir: "/home/admin/.openclaw/agents/main/sessions",
  
  // 状态文件（记录已同步的位置）
  state_file: "./.sync-state.json",
  
  // 同步间隔（毫秒）
  sync_interval: 60000, // 1 分钟
  
  // 每次最多同步的消息数
  max_messages_per_run: 100
};

let _config = null;
let _configLoadedAt = 0;
const CONFIG_CACHE_MS = 60000;

function loadConfig() {
  const now = Date.now();
  if (_config && (now - _configLoadedAt) < CONFIG_CACHE_MS) {
    return _config;
  }
  
  try {
    const configPath = path.resolve(__dirname, CONFIG_PATH);
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      _config = { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    } else {
      _config = { ...DEFAULT_CONFIG };
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
      console.log('📝 配置文件已创建：' + configPath);
    }
    _configLoadedAt = now;
    return _config;
  } catch (err) {
    console.error('❌ 加载配置失败:', err);
    return { ...DEFAULT_CONFIG };
  }
}

// ==================== 状态管理 ====================
function loadState() {
  try {
    const statePath = path.resolve(__dirname, DEFAULT_CONFIG.state_file);
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
  } catch (err) {
    console.error('[sync-log] Failed to load state:', err);
  }
  return { last_sync: Date.now(), processed_sessions: {} };
}

function saveState(state) {
  try {
    const statePath = path.resolve(__dirname, DEFAULT_CONFIG.state_file);
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[sync-log] Failed to save state:', err);
  }
}

// ==================== HTTP 请求 ====================
function httpRequest(url, options) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const req = lib.request(url, {
      ...options,
      signal: controller.signal
    }, (res) => {
      clearTimeout(timeoutId);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    
    req.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ==================== 日志记录 ====================
async function logInteraction(options) {
  const payload = {
    session_key: options.sessionKey || `session_${Date.now()}`,
    user_key: options.userKey || 'default_user',
    username: options.username || '匿名用户',
    channel: options.channel || CONFIG.platform,
    user_input: options.userInput,
    ai_response: options.aiResponse,
    input_type: 'text',
    latency_ms: options.latencyMs,
    token_usage: options.tokenUsage,
    cost: options.cost
  };
  
  try {
    const result = await httpRequest(`${CONFIG.api_base}/api/v1/interactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Token': CONFIG.bot_token
      },
      body: JSON.stringify(payload)
    });
    
    if (result.success) {
      console.log(`✅ 日志已记录 (ID: ${result.interaction_id})`);
      return result.interaction_id;
    } else {
      console.error(`❌ 记录失败：${result.error || '未知错误'}`);
      return null;
    }
  } catch (err) {
    console.error(`❌ 请求错误：${err.message}`);
    return null;
  }
}

// ==================== 会话处理 ====================
function listSessions() {
  try {
    const sessionsDir = path.resolve(__dirname, CONFIG.sessions_dir);
    const files = fs.readdirSync(sessionsDir);
    return files.filter(f => f.endsWith('.jsonl') && !f.endsWith('.lock'));
  } catch (err) {
    console.error('[sync-log] Failed to list sessions:', err);
    return [];
  }
}

function parseSessionFile(filename) {
  const sessionsDir = path.resolve(__dirname, CONFIG.sessions_dir);
  const filePath = path.join(sessionsDir, filename);
  const messages = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        messages.push(msg);
      } catch (e) {
        // Skip invalid lines
      }
    }
  } catch (err) {
    console.error(`[sync-log] Failed to read ${filename}:`, err);
  }
  
  return messages;
}

function extractUserInput(message) {
  if (message.content && Array.isArray(message.content)) {
    const textPart = message.content.find(c => c.type === 'text');
    if (textPart && textPart.text) {
      return textPart.text.trim();
    }
  }
  if (message.body) {
    const match = message.body.match(/\[用户输入\]([\s\S]*?)(?:\[系统提示\]|$)/i);
    if (match) return match[1].trim();
    return message.body.trim();
  }
  return '';
}

function extractAiResponse(message) {
  if (message.content && Array.isArray(message.content)) {
    const textPart = message.content.find(c => c.type === 'text');
    if (textPart && textPart.text) {
      const text = textPart.text;
      const match = text.match(/\[AI 回复\]([\s\S]*?)(?:\[|$)/i);
      if (match) return match[1].trim();
      return text.replace(/\[系统提示\][\s\S]*/i, '').trim();
    }
  }
  if (message.body) {
    if (message.toolResponse) return '';
    return message.body.trim();
  }
  return '';
}

async function syncSession(filename, state, debug = false) {
  const sessionId = filename.replace('.jsonl', '');
  const lastOffset = state.processed_sessions[sessionId] || 0;
  
  const messages = parseSessionFile(filename);
  if (messages.length <= lastOffset) {
    return 0;
  }
  
  const newMessages = messages.slice(lastOffset);
  let synced = 0;
  
  if (debug) {
    console.log(`  📄 ${filename}: ${messages.length} 条消息，新消息 ${newMessages.length} 条`);
  }
  
  // 收集所有 user 和 assistant 消息，稍后配对
  const userMessages = [];
  const assistantMessages = [];
  
  for (const msg of newMessages) {
    let messageData = null;
    let role = null;
    
    if (msg.type === 'message' && msg.message) {
      messageData = msg.message;
      role = messageData.role;
    } else if (msg.role) {
      messageData = msg;
      role = msg.role;
    } else {
      if (debug) console.log(`    跳过未知格式`);
      continue;
    }
    
    if (role === 'user') {
      userMessages.push(messageData);
      if (debug) {
        const input = extractUserInput(messageData);
        console.log(`    👤 用户输入：${input.substring(0, 80)}...`);
      }
    } else if (role === 'assistant') {
      assistantMessages.push(messageData);
      if (debug) {
        const resp = extractAiResponse(messageData);
        console.log(`    🤖 AI 回复片段`);
      }
    } else if (role === 'toolResult') {
      if (debug) console.log(`    🔧 工具结果，跳过`);
    }
  }
  
  // 配对 user 和 assistant 消息（按顺序）
  const maxPairs = Math.min(userMessages.length, assistantMessages.length);
  for (let i = 0; i < maxPairs; i++) {
    const userInput = extractUserInput(userMessages[i]);
    const aiResponse = assistantMessages.slice(i).map(m => extractAiResponse(m)).filter(Boolean).join('\n');
    
    if (userInput && !userInput.startsWith('/') && aiResponse) {
      await logInteraction({
        userInput: userInput,
        aiResponse: aiResponse,
        sessionKey: sessionId,
        userKey: userMessages[i].sender?.id || 'unknown',
        username: userMessages[i].sender?.name || '匿名用户',
        channel: userMessages[i].channel || 'openclaw'
      });
      synced++;
      
      if (debug) {
        console.log(`    ✅ 已记录配对 ${i + 1}`);
      }
    }
  }
  
  state.processed_sessions[sessionId] = messages.length;
  
  return synced;
}

async function runSync(debug = false) {
  console.log(`\n[${new Date().toISOString()}] 开始同步交互日志...`);
  
  const state = loadState();
  const sessions = listSessions();
  
  let totalSynced = 0;
  
  for (const session of sessions) {
    const synced = await syncSession(session, state, debug);
    totalSynced += synced;
  }
  
  state.last_sync = Date.now();
  saveState(state);
  
  console.log(`[${new Date().toISOString()}] 同步完成，共记录 ${totalSynced} 条交互`);
  
  return totalSynced;
}

async function main() {
  const args = process.argv.slice(2);
  const isDaemon = args.includes('--daemon') || args.includes('-d');
  const isDebug = args.includes('--debug') || args.includes('--dbg');
  
  CONFIG = loadConfig();
  
  console.log('🦐 交互日志同步工具');
  console.log(`配置：API=${CONFIG.api_base}, Bot=${CONFIG.bot_name}`);
  console.log(`模式：${isDaemon ? '守护进程' : '单次运行'}${isDebug ? ' (调试模式)' : ''}`);
  
  await runSync(isDebug);
  
  if (isDaemon) {
    console.log(`\n定时同步：每 ${CONFIG.sync_interval / 1000} 秒`);
    setInterval(() => runSync(isDebug), CONFIG.sync_interval);
  }
}

process.on('SIGINT', () => {
  console.log('\n收到退出信号，保存状态后退出...');
  process.exit(0);
});

main().catch(err => {
  console.error('[sync-log] Fatal error:', err);
  process.exit(1);
});
