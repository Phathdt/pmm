-- Update trade_type from 'liquid' to 'lending'
UPDATE trades SET trade_type = 'lending' WHERE trade_type = 'liquid';