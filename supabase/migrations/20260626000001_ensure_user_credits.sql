-- Garante que todo usuário existente tenha pelo menos 5 créditos
-- Caso a trigger não tenha disparado no momento do cadastro
INSERT INTO public.user_credits (user_id, credits)
SELECT id, 10 FROM auth.users
ON CONFLICT (user_id) DO UPDATE
  SET credits = GREATEST(public.user_credits.credits, 5);
