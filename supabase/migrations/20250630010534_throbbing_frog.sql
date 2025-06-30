/*
  # Fix admin panel loading issues

  1. Database Schema Updates
    - Ensure proper foreign key relationships for admin queries
    - Fix any missing constraints or references
    
  2. Security
    - Verify RLS policies allow admin access
    - Ensure proper user profile relationships
*/

-- Check if the constraint exists and points to the wrong table, then fix it
DO $$
BEGIN
  -- Check if constraint exists but points to auth.users instead of user_profiles
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'orders'
    AND tc.constraint_name = 'orders_user_id_fkey'
    AND ccu.table_name = 'auth'
  ) THEN
    -- Drop the existing constraint that points to auth.users
    ALTER TABLE orders DROP CONSTRAINT orders_user_id_fkey;
    
    -- Add the correct constraint pointing to user_profiles
    ALTER TABLE orders 
    ADD CONSTRAINT orders_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
    
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'orders' 
    AND constraint_name = 'orders_user_id_fkey'
  ) THEN
    -- Constraint doesn't exist, create it
    ALTER TABLE orders 
    ADD CONSTRAINT orders_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure user_interactions also references user_profiles instead of auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'user_interactions'
    AND kcu.column_name = 'user_id'
    AND ccu.table_name != 'user_profiles'
  ) THEN
    -- Drop existing constraint
    ALTER TABLE user_interactions DROP CONSTRAINT user_interactions_user_id_fkey;
    
    -- Add correct constraint
    ALTER TABLE user_interactions 
    ADD CONSTRAINT user_interactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure shopping_carts also references user_profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'shopping_carts'
    AND kcu.column_name = 'user_id'
    AND ccu.table_name != 'user_profiles'
  ) THEN
    -- Drop existing constraint
    ALTER TABLE shopping_carts DROP CONSTRAINT shopping_carts_user_id_fkey;
    
    -- Add correct constraint
    ALTER TABLE shopping_carts 
    ADD CONSTRAINT shopping_carts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure wishlists also references user_profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'wishlists'
    AND kcu.column_name = 'user_id'
    AND ccu.table_name != 'user_profiles'
  ) THEN
    -- Drop existing constraint
    ALTER TABLE wishlists DROP CONSTRAINT wishlists_user_id_fkey;
    
    -- Add correct constraint
    ALTER TABLE wishlists 
    ADD CONSTRAINT wishlists_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;