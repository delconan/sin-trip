# 狮城小队 · 新加坡亲子互动行程

面向 2026 年 7 月 7–10 日、两大两小的新加坡互动旅行手账。无需云端配置即可使用完整本地演示；配置 Supabase 与 OneMap 后，自动启用私密链接、多设备实时同步与官方路线查询。

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。本地调整保存到浏览器 `localStorage`。

## 启用多设备同步

1. 创建 Supabase 项目，在 Authentication → Providers 中启用 Anonymous Sign-Ins。
2. 使用 Supabase SQL Editor 按文件名顺序执行 `supabase/migrations/` 中的 SQL；已有项目至少需要补执行 `202606280002_day_titles.sql`。
3. 复制 `.env.example` 为 `.env.local`，填入 Supabase URL、publishable key 与 service role key。
4. 创建 OneMap API 账号，填写 `ONEMAP_API_EMAIL` 与 `ONEMAP_API_PASSWORD`。
5. 重启开发服务器。无令牌首页会等待你明确选择“保存当前行程到云端”或“创建共享行程”，不会静默创建另一份底稿。

分享链接是编辑凭证：拿到链接的人可以查看和修改行程。“重置访问”会轮换令牌并撤销其他匿名设备。

## Vercel 部署

将仓库导入 Vercel，在 Project Settings → Environment Variables 填入 `.env.example` 中的变量，然后部署。`SUPABASE_SERVICE_ROLE_KEY` 与 OneMap 密码只能配置为服务端变量，绝不能添加 `NEXT_PUBLIC_` 前缀。

### 把浏览器里现有行程安全迁移到云端

1. 在 Supabase 控制台启用 Authentication → Sign In / Providers → Anonymous Sign-Ins，并确认 `supabase/migrations/` 已全部执行。
2. 在 Vercel 配置 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 和仅服务端使用的 `SUPABASE_SERVICE_ROLE_KEY`，然后部署本版本。
3. 回到仍保存着修改的原电脑浏览器，刷新一次。页面应显示“先保存电脑里的当前行程”，而不是立即覆盖行程。
4. 点击“保存当前行程到云端”，等待顶部显示“已同步”，并确认地址变成 `/trip#<32位私密令牌>`。
5. 点击“分享”，把复制出的完整私密链接发送到手机并打开。手机只打开首页无法识别属于哪份私密行程，也不会自动发现电脑数据。

上传前应用会在原电脑的 `localStorage` 中写入 `singapore-family-trip-v1-backup` 备份。私密令牌本身就是编辑凭证，请只发给同行人员；如果链接泄露，可使用“重置访问”使旧链接失效。

## 验证命令

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

票价数据核对日期为 2026-06-27；应用只提供来源与预算参考，不处理付款。OneMap 暂不可用时会回退到本地估时，并保留 Google Maps 导航入口。
