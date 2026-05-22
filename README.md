# Discord Reset HWID Bot

一个最小可用的 Discord Slash Bot，用于管理 Reseller API 的常用操作。

## 功能

- Slash 指令：`/resethwid username:<用户名>`
- Slash 指令：`/generateloader username:<用户名>`
- 支持按 Discord 用户 ID、频道 ID 控制指令权限
- 所有回复均为 `ephemeral`
- `resethwid` 自动先查用户名，再调用 `resetHwid`
- `generateloader` 按用户名创建一个新版 loader build
- 本地 JSON Lines 审计日志，默认写入 `logs/audit.log`
- 可选 Discord 审计频道，同步推送所有操作结果

## 环境要求

- Node.js 18+
- 一个已创建好的 Discord Bot
- 可用的 Reseller API Key

## 安装

1. 复制配置模板：

```bash
cp .env.example .env
```

2. 填写 `.env`：

- `DISCORD_TOKEN`：Bot Token
- `DISCORD_CLIENT_ID`：Discord Application Client ID
- `DISCORD_GUILD_ID`：测试服务器 ID
- `RESELLER_API_KEY`：你的经销商 API Key
- `RESELLER_API_BASE_URL`：旧版 Reseller API 地址，用于查用户和生成加载器
- `RESET_HWID_API_BASE_URL`：新版解绑 HWID API 地址，例如 `https://playsharp.example.com/api/reseller/v1`；不配置时沿用 `RESELLER_API_BASE_URL`
- `LOADER_BUILDS_API_BASE_URL`：新版 loader builds API 地址，例如 `https://playsharp.example.com/api/reseller/v1`；不配置时沿用 `RESET_HWID_API_BASE_URL`
- `ALLOWED_DISCORD_USER_IDS`：允许使用命令的 Discord 用户 ID，多个逗号分隔；不配置时不限制用户
- `ALLOWED_DISCORD_CHANNEL_IDS`：允许使用命令的 Discord 频道 ID，多个逗号分隔；不配置时不限制频道
- `AUDIT_LOG_FILE_PATH`：审计日志文件路径，默认 `logs/audit.log`
- `AUDIT_CHANNEL_ID`：审计频道 ID；不配置时只写本地日志
- `GENERATE_LOADER_TIMEOUT_MS`：生成加载器接口超时，默认 `360000`（6 分钟）

权限规则：

- 只配置 `ALLOWED_DISCORD_USER_IDS`：只有指定用户可在任意频道使用
- 只配置 `ALLOWED_DISCORD_CHANNEL_IDS`：指定频道内所有人都可使用，其他频道不可使用
- 两者都配置：必须同时满足用户和频道白名单
- 两者都不配置：启动时报错，避免机器人完全开放

3. 安装依赖：

```bash
npm install
```

## 注册 Slash 指令

```bash
npm run deploy
```

如果你新增了 `/generateloader` 后还没看到指令，重新执行一次 `npm run deploy`。

## 启动机器人

```bash
npm start
```

## 使用方式

重置用户 HWID：

```text
/resethwid username:yy1234
```

创建指定用户的加载器构建：

```text
/generateloader username:yy1234
```

`/generateloader` 成功时会以私有 Embed 卡片返回：

- `构建 ID`
- `状态`
- `创建时间`
- `请求 ID`

常见结果：

- `已成功解绑 yy1234 的 HWID`
- `未找到用户 yy1234`
- `解绑失败：无权限`
- `加载器生成成功 ...`
- `生成失败：用户无有效订阅`
- `生成失败：服务器请求异常`

## 审计日志

每次尝试都会向日志文件写入一行 JSON，字段包括：

- `timestamp`
- `event`
- `actorDiscordUserId`
- `actorDiscordTag`
- `commandName`
- `targetUsername`
- `targetUserId`
- `outcome`
- `errorMessage`

事件名示例：

- `resethwid_attempt`
- `generateloader_attempt`

示例：

```json
{"timestamp":"2026-04-26T12:34:56.789Z","event":"generateloader_attempt","actorDiscordUserId":"10001","actorDiscordTag":"admin#0001","commandName":"generateloader","targetUsername":"yy1234","targetUserId":7788,"outcome":"success","errorMessage":null}
```

查看最近日志：

```bash
tail -f logs/audit.log
```

如果配置了 `AUDIT_CHANNEL_ID`，同一条审计事件也会发送到对应 Discord 频道。频道发送失败不会影响命令执行，错误会输出到机器人控制台。

## 测试

```bash
npm test
```
