# Setup Steps:

1. Install git, node, mongodb
2. run this in terminal, git clone https://github.com/neuronbet/NeuronAuto.git
3. run 'npm install' to install all dependencies

# Folder structure

This project consists of X parts:

1. express - handles all the routing
2. index - run all instances (browsers) synchronously
3. run - split to 4 steps

- setup (launch, login, setupPage)
- scrape (or ticket)
- brain
- autobet

4. TargetBookie - enter all the params in here
5. Acc credentials - easy to key in
6. public - pending, success, screening

# To RUN the program

1. define how many puppeteer instances to run at index.js folder
2. if running reference bookie, need to create new json at ReferenceBookie folder, json file name should be name + acc number (all in small caps, no space), eg. ps38381.json (now all change to targetbookie le)
3. if running TargetBookie, need to create new json at Target Bookie foler, json file name should be name + acc number (all in small caps, no space), eg. sbo11.json
4. run using 'npm run start'

# To see the mongodb

1. Open MongoDB compass
2. Connect to mongodb://localhost:27017
