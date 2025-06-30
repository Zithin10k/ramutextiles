/*
  # Add analytics tracking function

  1. New Functions
    - `update_product_analytics` - Function to update product analytics metrics
  
  2. Security
    - Function is accessible to public for tracking analytics
    - Uses upsert pattern to handle concurrent updates safely
*/

-- Function to update product analytics
CREATE OR REPLACE FUNCTION update_product_analytics(
  p_product_id uuid,
  p_metric text,
  p_increment integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update analytics record for today
  INSERT INTO product_analytics (
    product_id,
    date,
    views,
    likes,
    saves,
    shares,
    cart_adds,
    purchases
  )
  VALUES (
    p_product_id,
    CURRENT_DATE,
    CASE WHEN p_metric = 'views' THEN p_increment ELSE 0 END,
    CASE WHEN p_metric = 'likes' THEN p_increment ELSE 0 END,
    CASE WHEN p_metric = 'saves' THEN p_increment ELSE 0 END,
    CASE WHEN p_metric = 'shares' THEN p_increment ELSE 0 END,
    CASE WHEN p_metric = 'cart_adds' THEN p_increment ELSE 0 END,
    CASE WHEN p_metric = 'purchases' THEN p_increment ELSE 0 END
  )
  ON CONFLICT (product_id, date)
  DO UPDATE SET
    views = product_analytics.views + CASE WHEN p_metric = 'views' THEN p_increment ELSE 0 END,
    likes = product_analytics.likes + CASE WHEN p_metric = 'likes' THEN p_increment ELSE 0 END,
    saves = product_analytics.saves + CASE WHEN p_metric = 'saves' THEN p_increment ELSE 0 END,
    shares = product_analytics.shares + CASE WHEN p_metric = 'shares' THEN p_increment ELSE 0 END,
    cart_adds = product_analytics.cart_adds + CASE WHEN p_metric = 'cart_adds' THEN p_increment ELSE 0 END,
    purchases = product_analytics.purchases + CASE WHEN p_metric = 'purchases' THEN p_increment ELSE 0 END;
END;
$$;

-- Grant execute permission to public (for analytics tracking)
GRANT EXECUTE ON FUNCTION update_product_analytics TO public;