import MetaTrader5 as mt5
import sys
import json
import argparse
from datetime import datetime

def initialize_mt5():
    if not mt5.initialize():
        print(json.dumps({
            "success": False,
            "error": {
                "code": mt5.last_error(),
                "message": "MT5 initialization failed"
            }
        }))
        mt5.shutdown()
        sys.exit(1)

def check_connection():
    try:
        initialize_mt5()
        account_info = mt5.account_info()
        connected = account_info is not None
        
        result = {
            "success": connected,
            "account_info": {
                "login": account_info.login,
                "server": account_info.server,
                "balance": account_info.balance,
                "equity": account_info.equity
            } if connected else None
        }
        
        print(json.dumps(result))
        mt5.shutdown()
        return connected
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": {
                "message": str(e),
                "type": "CONNECTION_ERROR"
            }
        }))
        return False

def execute_trade(signal_data):
    try:
        initialize_mt5()
        
        # Validate required fields
        required_fields = ['symbol', 'volume', 'action', 'tp', 'sl']
        for field in required_fields:
            if field not in signal_data:
                raise ValueError(f"Missing required field: {field}")
        
        symbol = signal_data['symbol']
        volume = float(signal_data['volume'])
        action = signal_data['action']
        tp = float(signal_data['tp'])
        sl = float(signal_data['sl'])
        
        # Validate symbol
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            raise ValueError(f"Symbol {symbol} not found")
            
        if not symbol_info.visible:
            if not mt5.symbol_select(symbol, True):
                raise ValueError(f"Symbol {symbol} selection failed")
        
        # Get current price
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            raise ValueError(f"Failed to get price for {symbol}")
        
        # Determine order type and price
        order_type = mt5.ORDER_TYPE_BUY if action == 'BUY' else mt5.ORDER_TYPE_SELL
        price = tick.ask if action == 'BUY' else tick.bid
        
        # Prepare trade request
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "price": price,
            "sl": sl,
            "tp": tp,
            "deviation": 10,
            "magic": 202504,
            "comment": "Teaka AutoExec",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        # Send order
        result = mt5.order_send(request)
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            raise Exception(f"Order failed: {result.comment}")
        
        response = {
            "success": True,
            "order": {
                "ticket": result.order,
                "volume": result.volume,
                "price": result.price,
                "comment": result.comment
            }
        }
        
        print(json.dumps(response))
        mt5.shutdown()
        
    except ValueError as e:
        print(json.dumps({
            "success": False,
            "error": {
                "type": "VALIDATION_ERROR",
                "message": str(e)
            }
        }))
        mt5.shutdown()
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": {
                "type": "EXECUTION_ERROR",
                "message": str(e)
            }
        }))
        mt5.shutdown()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--check-connection', action='store_true')
    args = parser.parse_args()
    
    if args.check_connection:
        check_connection()
    else:
        try:
            # Read signal data from stdin
            signal_data = json.loads(sys.stdin.read())
            execute_trade(signal_data)
        except json.JSONDecodeError:
            print(json.dumps({
                "success": False,
                "error": {
                    "type": "INVALID_JSON",
                    "message": "Failed to parse signal data"
                }
            }))