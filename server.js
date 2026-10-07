/* 名场面 · 局域网多人版后端
   首次运行：npm install
   启动：npm start（或双击 启动服务器.bat）
   配置：编辑同目录 .env 填入 API Key
*/
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // 防止 Node 优先解析 IPv6 导致连不上 AI 接口（浏览器/curl 能连、Node 却卡住时常见）

const PORT = Number(process.env.PORT || 3000);

const CFG = {
  dsKey: process.env.DS_KEY || '',
  dsModel: process.env.DS_MODEL || 'deepseek-chat',
  sdKey: process.env.SD_KEY || '',
  sdModel: process.env.SD_MODEL || 'doubao-seedream-5-0-pro-260628'
};

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server);

/* ---------- DeepSeek 提示词模板 ---------- */
const DS_TEMPLATE = `你是一个用于“猜名字”游戏的图像提示词生成器。用户会输入一个中文名字。你只输出两段，不得输出任何额外说明、标题、寒暄、Markdown 代码块或解释。

输出格式必须严格为：

段落一：
中文提示词：...
英文提示词：...
负面提示词：text, letters, Chinese characters, watermark, logo, deformed, bad anatomy, messy composition, low quality, extra limbs

段落二：
“{{名字}}”可以拆成“字1→词1、字2→词2、...”。其中“字1”与“词1”同音，取“...”；“字2”直接保留在“词2”里；“字3”用会意/拆字/联想，取“...”。

生成规则（转换每个字时，严格按以下优先级，取第一个可行且具体可画的结果）：
1. 谐音（最优先、最可靠）：若存在拼音完全相同（忽略声调）的常见具体名词，就用它。例：“王 wáng→汪 wāng（小狗）”“震 zhèn→珍 zhēn（珍珠）”“佳 jiā→家 jiā（温馨的房子）”“慧 huì→卉 huì（花花草草）”“静 jìng→镜 jìng（镜子）”。拼音不同的一律禁止，例如“佳 jiā”绝不能谐成“带 dài”。
2. 字义：若这个字本身直接指某个具体可见事物（山、海、花、雪、雨、星、月、龙、凤、虎、林、云、石、金、木、水、火、玉、叶、果、桥、灯、舟、马、鸟……），就画这个事物。
3. 拆字：若这个字能拆出具体可见的偏旁/部件（明→日+月、森→树林、林→两棵树、辉→光），用那个具体部件。
4. 联想（最后手段，门槛极高）：只有前三者都不行时才允许，且联想必须让一个不认识该名字的人看到画面就能立刻、合理地反推出这个字；太绕、太牵强的联想（例如把“佳”联想成“梳头”）一律不要，宁可跳过这个字。

抽象字处理：很多名字字是抽象含义（佳=美好、慧=智慧、德、文、雅、婷、怡、欣、安、宁、祥、瑞、静……），本身画不出来。这类字先按第 1 条找谐音具体名词（佳→家、慧→卉、静→镜）；找不到就绝不硬编一个具体物，而是把它并进画面氛围（例如“佳”让整体色调温暖明亮、“静”让画面宁静柔和），或直接跳过，只突出其它能画的具体字。

整张图的核心元素控制在 1-3 个：挑 1 个最鲜明、最具体的作为绝对主角，其余作陪衬，共同放进一个连贯、趣味、儿童绘本风格的画面。主角要大、居中、细节清晰、占画面大部分；背景和无关物体尽量简化，禁止元素分散或平均排布。
中文提示词和英文提示词只描述画面，不得出现玩家原名字，不得要求画面出现文字。
中文提示词要明确主体、动作、场景、风格、构图、比例：以名字相关元素为主体，特写居中构图，背景简洁，画面无文字/水印/logo。英文提示词与中文对应。
负面提示词永远使用上面固定那串。
段落二只解释名字到视觉元素的变换，格式紧凑，最多两句话；不解释风格、构图、负面词、质量、seedream、API 等。若某字用的是会意/拆字/联想而非同音，就照实写成“取‘...’”，不要强行声称同音；跳过的字写成“弱化/并入氛围”。
输出前逐字核对：凡写“同音/谐音”的，拼音必须完全相同（忽略声调）；每个落到画面里的元素都要自问“陌生人看到这画面能否合理联想到这个字”，牵强就换掉或删掉；再检查主体是否突出、元素是否过多或分散、背景是否简洁。
不要输出“好的”“以下是”等多余内容。

示例：
输入：王金震
输出：
段落一：
中文提示词：儿童绘本风格趣味插画，一只可爱的棕色小狗作为画面绝对主角，特写居中、占据画面主体，它趴在池边好奇地盯着一颗圆润明亮的珍珠，水中一条小小的金鱼游动作陪衬，背景简洁虚化的温暖花园，梦幻幽默，色彩鲜艳，方形1:1，无文字、无水印、无logo。
英文提示词：Whimsical children's book illustration: a cute brown puppy as the absolute protagonist, close-up and centered, filling most of the frame, curiously staring at a round bright pearl by the pond, a small goldfish swimming in the water as a supporting detail, simple softly blurred warm garden background, dreamy and humorous, vibrant colors, square 1:1, no text, no letters, no watermark, no logo.
负面提示词：text, letters, Chinese characters, watermark, logo, deformed, bad anatomy, messy composition, low quality, extra limbs.
段落二：
“王金震”可以拆成“王→汪、金→金鱼、震→珍”。其中“王”与“汪”同音，取“小狗”；“金”直接保留在“金鱼”里；“震”与“珍”同音，取“珍珠”。

示例二（含抽象字，示范正确做法：优先谐音，不要瞎联想）：
输入：佳慧
输出：
段落一：
中文提示词：儿童绘本风格趣味插画，一栋温暖明亮的小房子作为画面绝对主角，特写居中、占画面主体，房子周围开满五颜六色的小花和绿植，画面温馨美好、色彩明快，背景简洁虚化，方形1:1，无文字、无水印、无logo。
英文提示词：Whimsical children's book illustration: a cozy bright little house as the absolute protagonist, close-up and centered, filling most of the frame, surrounded by colorful small flowers and green plants, warm and lovely atmosphere, vibrant cheerful colors, square 1:1, no text, no letters, no watermark, no logo.
负面提示词：text, letters, Chinese characters, watermark, logo, deformed, bad anatomy, messy composition, low quality, extra limbs.
段落二：
“佳慧”可以拆成“佳→家、慧→卉”。其中“佳”与“家”同音，取“温馨的房子”；“慧”与“卉”同音，取“花花草草”。

玩家输入的名字是：{{name}}`;

const DS_SYSTEM = DS_TEMPLATE.slice(0, DS_TEMPLATE.indexOf('玩家输入的名字是：{{name}}')).trim();
const DS_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const SD_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

/* ---------- 名字 → 头像 ---------- */
const EMOJIS = ['🦊', '🐼', '🐸', '🦁', '🐯', '🐨', '🐵', '🐙', '🦄', '🐬', '🐳', '🦋', '🐞', '🐌', '🐢', '🐰', '🐱', '🐶', '🐷', '🐮', '🐥', '🦉', '🦅', '🐺', '🦇', '🦈', '🐠', '🦀'];
const COLORS = ['#ff6b5e', '#2ec4a6', '#ff9f43', '#5f6cff', '#e05fd0', '#2bc0e4', '#f7b731', '#26de81', '#fd7272', '#778beb'];
function hashName(s) { let h = 5381; for (const ch of s) h = ((h << 5) + h + ch.codePointAt(0)) >>> 0; return h; }
function avatar(name) { const h = hashName(name); return { emoji: EMOJIS[h % EMOJIS.length], color: COLORS[h % COLORS.length] }; }

/* ---------- 解析 DeepSeek 输出（第一段 / 第二段） ---------- */
function parseDeepseek(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '');
  const find = (markers) => {
    let idx = -1, len = 0;
    for (const m of markers) { const i = t.indexOf(m); if (i >= 0 && (idx < 0 || i < idx)) { idx = i; len = m.length; } }
    return idx < 0 ? null : { idx, len };
  };
  const s2 = find(['段落二', '第二段']);
  let sec1 = t, sec2 = '';
  if (s2) {
    sec1 = t.slice(0, s2.idx);
    sec2 = t.slice(s2.idx + s2.len).replace(/^[:：]\s*/, '').trim();
  }
  const s1 = find(['段落一', '第一段']);
  if (s1 && (!s2 || s1.idx < s2.idx)) sec1 = sec1.slice(s1.idx + s1.len).replace(/^[:：]\s*/, '').trim();
  sec1 = sec1.trim();
  const field = (names) => {
    for (const n of names) {
      const i = sec1.indexOf(n);
      if (i < 0) continue;
      let rest = sec1.slice(i + n.length).replace(/^[:：]\s*/, '');
      const nexts = ['中文提示词', '英文提示词', '负面提示词', '段落一', '段落二', '第一段', '第二段'];
      let end = rest.length;
      for (const nn of nexts) { const j = rest.indexOf(nn); if (j > 0) end = Math.min(end, j); }
      return rest.slice(0, end).trim();
    }
    return '';
  };
  return { cn: field(['中文提示词']), en: field(['英文提示词']), neg: field(['负面提示词']), sec2 };
}

function buildImagePrompt(p) {
  const parts = [];
  if (p.cn) parts.push(p.cn);
  if (p.en) parts.push(p.en);
  if (p.neg) parts.push('avoid: ' + p.neg);
  return parts.join('\n');
}

/* ---------- 调用两个 API ---------- */
const DS_TIMEOUT = 60000;   // DeepSeek 写提示词：60 秒超时
const SD_TIMEOUT = 90000;   // Seedream 画图：90 秒超时（画图本就慢，多留余量）

function isAbortError(e) {
  return !!(e && (e.name === 'AbortError' || (e.cause && e.cause.name === 'AbortError')));
}

async function fetchWithTimeout(url, options, ms, label) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, Object.assign({}, options, { signal: ctrl.signal }));
  } catch (e) {
    if (isAbortError(e)) throw new Error(label + ' 超时（' + Math.round(ms / 1000) + ' 秒无响应，请检查网络）');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function deepseekGenerate(name) {
  if (!CFG.dsKey) throw new Error('未配置 DeepSeek Key');
  const resp = await fetchWithTimeout(DS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CFG.dsKey },
    body: JSON.stringify({
      model: CFG.dsModel,
      messages: [
        { role: 'system', content: DS_SYSTEM },
        { role: 'user', content: '玩家输入的名字是：' + name }
      ],
      temperature: 0.3,
      stream: false
    })
  }, DS_TIMEOUT, 'DeepSeek');
  if (!resp.ok) throw new Error('DeepSeek ' + resp.status + ' ' + (await resp.text()).slice(0, 200));
  const data = await resp.json();
  const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!c) throw new Error('DeepSeek 返回为空');
  return c;
}

async function seedreamGenerate(prompt) {
  if (!CFG.sdKey) throw new Error('未配置 Seedream Key');
  const resp = await fetchWithTimeout(SD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CFG.sdKey },
    body: JSON.stringify({
      model: CFG.sdModel,
      prompt: prompt,
      size: '1024x1024',
      response_format: 'b64_json',
      watermark: false
    })
  }, SD_TIMEOUT, 'Seedream');
  if (!resp.ok) {
    let detail = '';
    try { const j = await resp.json(); detail = (j.error && j.error.message) ? j.error.message : JSON.stringify(j); }
    catch (e) { detail = await resp.text(); }
    throw new Error('Seedream ' + resp.status + ' ' + String(detail).slice(0, 300));
  }
  const data = await resp.json();
  const item = data && data.data && data.data[0];
  if (!item) throw new Error('Seedream 未返回图片');
  if (item.b64_json) {
    const fmt = String(item.output_format || item.format || '').toLowerCase();
    return 'data:' + (fmt === 'png' ? 'image/png' : 'image/jpeg') + ';base64,' + item.b64_json;
  }
  if (item.url) return item.url;
  throw new Error('Seedream 返回格式未知');
}

async function buildImageQuestion(name, onStep) {
  if (onStep) onStep('deepseek');
  const raw = await deepseekGenerate(name);
  const p = parseDeepseek(raw);
  const prompt = buildImagePrompt(p);
  if (!prompt) throw new Error('提示词解析为空');
  if (onStep) onStep('seedream');
  const image = await seedreamGenerate(prompt);
  return { name, image, sec2: p.sec2 };
}

/* ---------- 房间（内存） ---------- */
const rooms = {};
function newCode() {
  let c;
  do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms[c]);
  return c;
}
function isPrivateIPv4(ip) {
  const p = String(ip).split('.').map(Number);
  if (p.length !== 4 || p.some((n) => isNaN(n))) return false;
  if (p[0] === 10) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  return false;
}

// 需要排除的虚拟网卡 / VPN / 虚拟机网卡（按英文名关键字过滤）
const VIRTUAL_IF_RE = /virtual|vmware|vbox|virtualbox|hyper-v|vethernet|wsl|tailscale|zerotier|tun|tap|docker|loopback|bluetooth|hamachi|radmin|vpn|nord|proton|pia|softether|expressvpn/i;

function lanIPs() {
  const ifs = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(ifs)) {
    if (VIRTUAL_IF_RE.test(name)) continue;
    for (const it of ifs[name] || []) {
      if (it.family === 'IPv4' && !it.internal) {
        out.push({ name, ip: it.address, priv: isPrivateIPv4(it.address) });
      }
    }
  }
  return out;
}

function lanIP() {
  const list = lanIPs();
  const priv = list.find((x) => x.priv);
  if (priv) return priv.ip;
  if (list.length) return list[0].ip;
  return 'localhost';
}

async function generateQuestions(room, hostSocket) {
  const members = room.members.slice();
  room.questions = [];
  for (const m of members) {
    try {
      const q = await buildImageQuestion(m.name, (step) => {
        hostSocket.emit('gen-progress', { name: m.name, state: 'working', step });
      });
      q.emoji = m.emoji;
      q.color = m.color;
      q.profile = m.profile;
      room.questions.push(q);
      hostSocket.emit('gen-progress', { name: m.name, state: 'done' });
    } catch (e) {
      hostSocket.emit('gen-progress', { name: m.name, state: 'error', msg: String((e && e.message) || e) });
      room.state = 'lobby';
      return;
    }
  }
  room.state = 'playing';
  hostSocket.emit('game-started', { questions: room.questions });
}

io.on('connection', (socket) => {
  socket.on('host-create', () => {
    if (socket.roomCode && rooms[socket.roomCode]) {
      io.to(socket.roomCode).emit('host-left');
      delete rooms[socket.roomCode];
    }
    const code = newCode();
    rooms[code] = { code, hostId: socket.id, members: [], questions: [], qIndex: -1, state: 'lobby' };
    socket.roomCode = code;
    socket.join(code);
    socket.emit('host-created', { code, lanIP: lanIP(), ips: lanIPs().map((x) => x.ip), port: PORT });
  });

  socket.on('check-room', (d) => {
    const room = rooms[d && d.code];
    if (!room) return socket.emit('room-bad', '房间不存在');
    if (room.state !== 'lobby') return socket.emit('room-bad', '游戏已开始，无法加入');
    socket.emit('room-ok');
  });

  socket.on('join-room', (d) => {
    const room = rooms[d && d.code];
    if (!room) return socket.emit('join-error', '房间不存在');
    if (room.state !== 'lobby') return socket.emit('join-error', '游戏已开始，无法加入');
    const name = String((d && d.name) || '').trim();
    if (!name) return socket.emit('join-error', '名字不能为空');
    // 允许同名重进（替换旧成员，方便断线重连）
    room.members = room.members.filter((m) => m.name !== name);
    const av = avatar(name);
    const member = { id: socket.id, name, emoji: av.emoji, color: av.color, profile: (d && d.profile) || [] };
    room.members.push(member);
    socket.roomCode = d.code;
    socket.join(d.code);
    socket.emit('joined', { selfId: socket.id, members: room.members });
    socket.to(d.code).emit('members', room.members);
  });

  socket.on('start-game', () => {
    const room = rooms[socket.roomCode];
    if (!room || room.hostId !== socket.id || room.state !== 'lobby') return;
    if (!room.members.length) return socket.emit('gen-error', '至少需要 1 名成员加入');
    if (!CFG.dsKey || !CFG.sdKey) return socket.emit('gen-error', '服务器未配置 API Key，请编辑 .env 填入 DS_KEY 和 SD_KEY');
    room.state = 'generating';
    generateQuestions(room, socket);
  });

  const relay = (event) => (d) => {
    const room = rooms[socket.roomCode];
    if (!room || room.hostId !== socket.id) return;
    socket.to(socket.roomCode).emit(event, d);
  };
  socket.on('host-next-question', relay('question'));
  socket.on('host-reveal', relay('reveal'));
  socket.on('host-egg', relay('egg'));
  socket.on('host-finish', () => {
    const room = rooms[socket.roomCode];
    if (!room || room.hostId !== socket.id) return;
    socket.to(socket.roomCode).emit('game-over', { members: room.members });
  });

  socket.on('disconnect', () => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    if (room.hostId === socket.id) {
      io.to(socket.roomCode).emit('host-left');
      delete rooms[socket.roomCode];
    } else {
      room.members = room.members.filter((m) => m.id !== socket.id);
      socket.to(socket.roomCode).emit('members', room.members);
    }
  });
});

async function checkReachable(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const resp = await fetch(url, { method: 'GET', signal: ctrl.signal });
    return { reachable: true, status: resp.status };
  } catch (e) {
    return { reachable: false, msg: String((e && e.message) || e) };
  } finally {
    clearTimeout(t);
  }
}

async function runSelfTest() {
  console.log('  正在检测 AI 接口连通性（约几秒）…');
  const [ds, sd] = await Promise.all([
    checkReachable('https://api.deepseek.com', 10000),
    checkReachable('https://ark.cn-beijing.volces.com', 10000)
  ]);
  const pad = (s) => (s.reachable ? '可连通 (HTTP ' + s.status + ')' : '连接失败 ' + (s.msg || ''));
  console.log('  [自检] DeepSeek 接口:  ' + pad(ds));
  console.log('  [自检] Seedream 接口:  ' + pad(sd));
  if (!CFG.dsKey) console.log('  [自检] 警告: DS_KEY 未配置（.env 里没有）');
  if (!CFG.sdKey) console.log('  [自检] 警告: SD_KEY 未配置（.env 里没有）');
  console.log('  注: 返回 401/404 也算可连通，说明网络没问题。');
  console.log('');
}

server.listen(PORT, () => {
  console.log('\n==============================================');
  console.log('  名场面 服务器已启动');
  console.log('  本机访问:     http://localhost:' + PORT);
  const ips = lanIPs();
  if (ips.length) {
    ips.forEach((x) => console.log('  局域网访问:   http://' + x.ip + ':' + PORT + '   (' + x.name + ')'));
  } else {
    console.log('  未检测到局域网 IP，请检查电脑的网络连接');
  }
  console.log('  （手机与电脑需在同一 WiFi，优先用 192.168.x.x 那个地址）');
  console.log('==============================================\n');
  runSelfTest();
});
