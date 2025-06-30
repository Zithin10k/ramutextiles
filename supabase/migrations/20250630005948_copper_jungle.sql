/*
  # Make zithinsp@gmail.com an admin

  1. Updates
    - Set is_admin = true for user with email zithinsp@gmail.com
    - Creates user profile if it doesn't exist
*/

-- Update existing user profile to admin or create if doesn't exist
INSERT INTO user_profiles (id, email, is_admin, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  true,
  now(),
  now()
FROM auth.users au
WHERE au.email = 'zithinsp@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  is_admin = true,
  updated_at = now();