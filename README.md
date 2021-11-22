# xALPACA
The Governance Module for Alpaca Finance.

## Local Development
The following assumes the use of `node@>=14`.

### Install Dependencies
 1. Copy `.env.example` file and change its name to `.env` in the project folder
 2. Run `yarn` to install all dependencies

### Compile Contracts
`yarn compile`

### Run Unit Tests
`yarn test`

### Run Integration Tests
`yarn integration-test`

#### specific integration test
```
yarn integration-test:feeder-fairlaunch
yarn integration-test:feeder-worker
```

## Licensing
The primary license for Alpaca Protocol is the MIT License, see [MIT LICENSE](https://github.com/alpaca-finance/xALPACA/blob/main/LICENSE).
