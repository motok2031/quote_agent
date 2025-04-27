# Influence AI - AI-Powered SocialFi Platform

Influence AI is an AI-powered SocialFi platform that aims to revolutionize social media and financial integration through artificial intelligence. The platform leverages advanced AI technology to provide users with intelligent social media interactions and financial trading experiences.

## Project Structure

```
src/
├── agent.ts          # AI agent implementation, responsible for Twitter platform interaction
├── assistant.ts      # AI assistant implementation, handles user requests and responses
├── db.ts            # Database operations, manages user data and transaction records
├── functions.ts     # Common utility functions
├── index.ts         # Project entry file
├── network.ts       # Network request handling, interacts with Twitter API
├── prompts_tools_funcs.ts  # AI prompts and tool functions
├── test/            # Test directory
├── types.ts         # TypeScript type definitions
├── twitterclient.ts # Twitter client implementation
└── utils.ts         # Utility functions
```

## Key Features

- **AI Agent System**: Implements intelligent social media interactions through AI technology
- **Twitter Integration**: Deep integration with Twitter platform, supporting tweets, follows, DMs, and more
- **Data Management**: Uses SQLite database to store user data and transaction records
- **Network Communication**: Handles communication with Twitter API, supports real-time message push
- **Utility Functions**: Provides various auxiliary functions, such as image processing, text analysis, etc.
- **BSC Payment Integration**: Supports Binance Smart Chain (BSC) for seamless cryptocurrency transactions

## BSC Payment Features

- **Smart Contract Integration**: Secure and efficient payment processing on BSC
- **Token Support**: Compatible with BEP-20 tokens
- **Transaction Tracking**: Real-time monitoring of payment status
- **Gas Optimization**: Efficient gas usage for transactions
- **Multi-token Support**: Support for various BSC tokens

## Setup Instructions

1. Clone the project
```bash
git clone [project-url]
cd [project-directory]
```

2. Install dependencies
```bash
pnpm install
```

3. Configure environment variables
Create a `.env` file with the following variables:
```
OPENAI_API_KEY=your-openai-api-key
OPENAI_API_KEY_IMAGE=your-openai-image-api-key
TWITTER_USERNAME=your-twitter-username
TWITTER_PASSWORD=your-twitter-password
TWITTER_EMAIL=your-twitter-email
BSC_RPC_URL=your-bsc-rpc-url
BSC_PRIVATE_KEY=your-bsc-wallet-private-key
BSC_SENDER_ADDRESS=your-bsc-wallet-address
```

4. Run the project
```bash
pnpm build
pnpm start
```

## Environment Variables

- `OPENAI_API_KEY`: OpenAI API key for AI text generation
- `OPENAI_API_KEY_IMAGE`: OpenAI image API key for AI image generation
- `TWITTER_USERNAME`: Twitter account username
- `TWITTER_PASSWORD`: Twitter account password
- `TWITTER_EMAIL`: Twitter account email
- `BSC_RPC_URL`: BSC RPC endpoint URL
- `BSC_PRIVATE_KEY`: Private key for BSC wallet
- `BSC_SENDER_ADDRESS`: Address BSC wallet

## Important Notes

- Ensure all environment variables are properly configured
- Recommended Node.js version: 16+
- Valid Twitter account and OpenAI API keys are required
- BSC wallet with sufficient funds for gas fees
- First run may require waiting for dependency installation
- Keep your private keys secure and never commit them to version control
