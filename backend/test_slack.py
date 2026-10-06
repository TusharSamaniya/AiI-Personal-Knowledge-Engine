import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from app.integrations.slack import list_slack_channels, list_slack_users


async def test():
    token = os.getenv("SLACK_BOT_TOKEN_TEST")
    if not token:
        print("ERROR: SLACK_BOT_TOKEN_TEST is not set in .env")
        return
    
    print(f"Token starts with: {token[:10]}...")
    
    channels = await list_slack_channels(token)
    print(f"\nFound {len(channels)} channels:")
    for c in channels[:10]:
        print(f"  - #{c['name']} (id: {c['id']})")
    
    users = await list_slack_users(token)
    print(f"\nFound {len(users)} users:")
    for uid, name in list(users.items())[:5]:
        print(f"  - {name} ({uid})")


if __name__ == "__main__":
    asyncio.run(test())