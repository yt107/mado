-- Custom SQL migration file, put your code below! --
-- Mado は Supabase の Data API（REST・GraphQL）を使わない。
-- Supabase が public に自動で付ける Data API 用のロール（anon・authenticated・service_role）の権限を外して、
-- Data API をオンにしてしまっても、テーブルを読み書きできないようにする。
-- https://supabase.com/docs/guides/api/securing-your-api

-- 今あるテーブルから外す
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
--> statement-breakpoint
-- これから作るテーブル・シーケンス・関数にも、自動で付かないようにする
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM public;