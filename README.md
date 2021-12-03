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

### Step to setting up mainnet fork environment
1. Run mainnetfork in background process.
    ```console
    $ tmux new -s session_name
    $ tmux attach -d -t <session_name>
    $ cd xALPACA-contract
    $ yarn mainnet-fork & => (running mainnetfork in background process)
    ```
2. Run setting up test to prepare environment for mainnetfork
   
    command
    ```console
    $ yarn script:mainnetfork:prepare-test
    ```
    results example
    ```console
        ProxyToken address: 0x02442d7ff3dbFa3C6F0157db70235c258c2fD296
        DTOKEN address:  0x3d23B3F2b6E1Cb62c4FA4bd77ADf57516eDE3cF1
        BTOKEN address:  0x3C77ed94188E3de0c13E64A3f1ae37Ab3c0CFa78
        ALPACA address:  0x8F0528cE5eF7B51152A59745bEfDD91D97091d2F
        xAlpaca address:  0x35f5fC470F9BFff5fE4fc1B240d9316959EcF6Cf
        GrassHouse address:  0x00aA1ACD7DD317fF0528d6ccf47cbA8232e2986b
        AlpacaGrassHouse address:  0xFe27998cA9C891f877db9c1917F349ADeb2808A9
        AlpacaFeeder address:  0xC26A8160563D23891D7fd0Cc3Fbf9120f77176Ff
        ✅ Done
    ```
    #### Step after setting up mainnetfork Example
                                          3             5
                            1 2           4             6                            
                ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ + ─ ─ ─ ─ ─ ─ ▶ Time (DAY)
                            W1            W2            W3
    1. Move blocktimestamp to W1 (Assuming W1 is next week) and Deployer call checkpointToken to move lastTokenTimestamp to W1.
        command to move to start week and deployer call checkpoint
        ```console
        $ yarn task:set-timestamp-startweek
        $ yarn task:checkpoint --grasshouseaddress <addressOfGrassHoue>
        ```
    2. Someone lock ALPACA at [W1 + 1 day]
        command to advance 1 day
        ```console
        $ yarn task:advancetime --days 1
        ```
    3. Move timestamp to W2
        command to move to week 2
        ```console
        $ yarn task:set-timestamp-startweek
        ```
    4. Deployer call checkpoint to move lastTokenTimestamp to W2 to allocate rewards to W2 only. Deployer call feed() to feed token to GrassHouse. Enable canCheckpointToken.
        command to checkpoint, feed token to grasshouse, enable canCheckpointToken
        ```console
        $ yarn task:checkpoint --grasshouseaddress <addressOfGrassHouse>
        $ yarn task:feed-grasshouse --grasshouseaddress <addressOfGrassHose> --grasshousetokenaddress <addressOfToken> --amount <amountToBeFeedGrassHouse>
        $ yarn task:enable-checkpoint --grasshouseaddress <addressOfGrassHouse>
        ```
    5. Move timestamp to W3
        command to move to week 3
        ```console
        $ yarn task:set-timestamp-startweek
        ```
    6. Call checkpointTotalSupply to allocate reward
        command to call checkpointTokenSupply
        ```console
        $ yarn task:checkpoint-total-supply --grasshouseaddress <addressOfGrassHouse>
        ```

## Licensing
The primary license for Alpaca Protocol is the MIT License, see [MIT LICENSE](https://github.com/alpaca-finance/xALPACA/blob/main/LICENSE).
