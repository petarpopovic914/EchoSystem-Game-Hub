import * as PIXI from 'pixi.js';
import { GameState } from './core/GameState';
import { GameScene } from './views/GameScene';
import { GameConfig } from './config/GameConfig';

const app = new PIXI.Application();

(async () => {
    // 1. SETUP PIXI
    const wrapper = document.getElementById('game-wrapper');
    await app.init({ background: GameConfig.colors.background, resizeTo: wrapper });
    wrapper.appendChild(app.canvas);

    const gameState = new GameState();
    const gameScene = new GameScene(app.screen.width, app.screen.height);
    app.stage.addChild(gameScene);

    const historyLog = [];

    // 2. REAL ASSET LOADER
    const loaderBar = document.getElementById('loader-bar');
    const loaderText = document.getElementById('loader-text');
    const loaderEl = document.getElementById('loader');

    await gameScene.initAssets((progress) => {
        const pct = Math.floor(progress * 100);
        if (loaderBar) loaderBar.style.width = pct + '%';
        if (loaderText) loaderText.innerText = "LOADING... " + pct + "%";
    });

    setTimeout(() => {
        if (loaderEl) loaderEl.style.display = 'none';
        updateGlobalUI();
        gameScene.setIdleState(); 
    }, 500);

    function addHistoryItem(multiplier) {
        const bar = document.getElementById('history-bar');
        const item = document.createElement('div');
        
        item.innerText = multiplier.toFixed(2) + "x";
        item.className = 'history-item';

        // Color Logic
        if (multiplier >= 10.0) item.classList.add('high');
        else if (multiplier >= 2.0) item.classList.add('win');
        else item.classList.add('loss');

        // Prepend to start (newest on left)
        bar.prepend(item);

        // Keep only last 20 items to save memory
        if (bar.children.length > 20) {
            bar.removeChild(bar.lastChild);
        }
    }

    // 3. UI CONTROLLER
    function setupPanel(panelId, betId) {
        const panel = document.getElementById(panelId);
        const btnMinus = panel.querySelector('.minus');
        const btnPlus = panel.querySelector('.plus');
        const inputVal = panel.querySelector('.bet-input'); 
        const quickBtns = panel.querySelectorAll('.btn-quick');
        const actionBtn = panel.querySelector('.main-btn');
        const lblAction = actionBtn.querySelector('.btn-label');
        const lblValue = actionBtn.querySelector('.btn-value');

        let localBet = 100;

        function updateInputDisplay() {
            if (localBet < 50) localBet = 50;
            if (localBet > 10000) localBet = 10000;
            inputVal.value = localBet;
            updateButtonState();
        }

        if (inputVal) {
            inputVal.oninput = () => {
                let val = parseInt(inputVal.value);
                if (isNaN(val) || val < 0) val = 0;
                localBet = val;
                updateButtonState();
            };
            inputVal.onblur = () => { updateInputDisplay(); };
        }

        // --- MAIN UI UPDATER ---
        function updateButtonState() {
            const state = gameState.bets[betId];
            const phase = gameState.phase;

            // 1. GAME OVER (CRASHED)
            if (phase === 'GAME_OVER') {
                actionBtn.disabled = true; // Button is unclickable
                if(inputVal) inputVal.disabled = true;

                if (state.placed && !state.cashedOut) {
                    // --- PLAYER LOST (BUST) ---
                    // REVERTED TO RED: using 'betting' class
                    actionBtn.className = 'btn-action betting'; 
                    lblAction.innerText = "BUSTED"; 
                    lblValue.innerText = "0 RSD";
                } 
                else if (state.cashedOut) {
                    // --- PLAYER WON ---
                    actionBtn.className = 'btn-action'; // Green Background
                    lblAction.innerText = "WON";
                    lblValue.innerText = state.win.toFixed(0) + " RSD";
                } 
                else {
                    // --- DID NOT PLAY ---
                    actionBtn.className = 'btn-action';
                    lblAction.innerText = "CRASHED";
                    lblValue.innerText = "@ " + gameState.multiplier.toFixed(2) + "x";
                }
            }
            
            // 2. GAME RUNNING
            else if (phase === 'RUNNING') {
                if (state.active && !state.cashedOut) {
                    actionBtn.className = 'btn-action betting';
                    lblAction.innerText = "CASHOUT";
                    lblValue.innerText = (localBet * gameState.multiplier).toFixed(0);
                    actionBtn.disabled = false;
                    if(inputVal) inputVal.disabled = true;
                } else {
                    actionBtn.className = 'btn-action';
                    lblAction.innerText = "WAITING";
                    lblValue.innerText = "IN PROGRESS";
                    actionBtn.disabled = true;
                    if(inputVal) inputVal.disabled = true;
                }
            } 
            
            // 3. BETTING PHASE (COUNTDOWN)
            else if (phase === 'BETTING') {
                const time = Math.ceil(gameState.timeRemaining);
                if(inputVal) inputVal.disabled = state.placed;
                
                if (state.placed) {
                    actionBtn.className = 'btn-action betting';
                    lblAction.innerText = `CANCEL (${time}s)`;
                    lblValue.innerText = localBet + " RSD";
                } else {
                    actionBtn.className = 'btn-action';
                    lblAction.innerText = `BET (${time}s)`;
                    lblValue.innerText = localBet + " RSD";
                }
                actionBtn.disabled = false;
            }
            
            // 4. IDLE PHASE
            else { 
                if(inputVal) inputVal.disabled = state.placed;
                if (state.placed) {
                    actionBtn.className = 'btn-action betting';
                    lblAction.innerText = "WAITING...";
                    lblValue.innerText = localBet + " RSD";
                } else {
                    actionBtn.className = 'btn-action';
                    lblAction.innerText = "PLACE BET";
                    lblValue.innerText = localBet + " RSD";
                }
                actionBtn.disabled = false;
            }
        }

        // --- EVENTS ---
        btnMinus.onclick = () => { localBet -= 50; updateInputDisplay(); };
        btnPlus.onclick = () => { localBet += 50; updateInputDisplay(); };
        quickBtns.forEach(b => {
            b.onclick = () => { localBet += parseInt(b.dataset.amt); updateInputDisplay(); };
        });

        actionBtn.onclick = () => {
            const state = gameState.bets[betId];
            
            if (gameState.phase === 'RUNNING') {
                if (state.active) {
                    const result = gameState.cashOut(betId);
                    updateGlobalUI(); 
                    if (result.allCashed) {
                        const totalWin = gameState.bets[1].win + gameState.bets[2].win;
                        gameScene.setGameOver('ESCAPE', gameState.multiplier, totalWin);
                        gameState.triggerGameOver(); 
                    } else {
                        gameScene.setGameOver('WIN_EFFECT', result.win);
                    }
                }
            } 
            else {
                if (state.placed) {
                    gameState.cancelBet(betId);
                } else {
                    gameState.placeBet(betId, localBet);
                }
            }
            updateButtonState();
        };

        if(inputVal) inputVal.value = localBet;

        return updateButtonState;
    }

    const updatePanel1 = setupPanel('panel-1', 1);
    const updatePanel2 = setupPanel('panel-2', 2);

    function updateGlobalUI() {
        document.getElementById('balance').innerText = gameState.balance.toLocaleString();
    }

    // 4. GAME LOOP
    let isTransitioning = false;

    app.ticker.add((ticker) => {
        const status = gameState.update(ticker.deltaTime);
        
        updatePanel1();
        updatePanel2();

        if (status === 'STARTED') {
             updateGlobalUI(); 
        }

        if (status === 'CRASH') {
            gameScene.setGameOver('CRASH', gameState.multiplier);
            
            // *** CALL HISTORY UPDATE HERE ***
            addHistoryItem(gameState.multiplier);
        } 

        if (gameState.phase === 'GAME_OVER' && !isTransitioning) {
            isTransitioning = true;
            setTimeout(() => {
                gameScene.transitionToIdle(() => {
                    gameState.resetToIdle(); 
                    isTransitioning = false;
                });
            }, 2000);
        }

        gameScene.update(gameState.multiplier, gameState.phase, gameState.timeRemaining);
    });

    // Handle Resize
    window.addEventListener('resize', () => {
        if(wrapper && gameScene.layout) {
            app.renderer.resize(wrapper.clientWidth, wrapper.clientHeight);
            gameScene.appWidth = app.screen.width;
            gameScene.appHeight = app.screen.height;
            gameScene.layout();
        }
    });

})();   