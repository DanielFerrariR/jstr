# tr2sa: Convert Trade Republic Transactions History to Snowball Analytics CSV

This library only purpose is to generate a CSV file for Snowball Analytics.

Currently supported transactions:

- trades
- savings plans
- roundups
- 15 euros per month bonus
- dividends
- interests
- tax corrections
- received stock gift

## What is currently supported

- Connect to WebSocket (interact via prompt)
  - Known supported commands (token is already added to the messages):
    - Transactions: {"type": "timelineTransactions"} // can add 'after' with the previous response to get the next list
    - Transaction Details: {"type": "timelineDetailV2", "id": timeline_id } // timeline_id is the transaction id
    - Activity Log: {"type": "timelineActivityLog" } // can add 'after' with the previous response to get the next list
    - Can get more of options from https://github.com/pytr-org/pytr/blob/master/pytr/api.py code, but this project isn't supporting and explaining how to use the others for now
- Download JSON and convert it to Snowball CSV
- Import existing JSON and convert it to Snowball CSV (connection to Trade Republic api isn't needed)

## Steps

1 - Install Node 20.19.0

2 - npm install

3 - Create a .env file (check .env.example)

4 - npm run cli
