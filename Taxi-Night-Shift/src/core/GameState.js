import { GameConfig } from '../config/GameConfig';

export class GameState {
    constructor() {
        this.multiplier = 1.00;
        this.phase = 'IDLE'; 
        this.crashPoint = 0;
        this.balance = 50000; 
        this.timeRemaining = 0; 

        this.bets = {
            1: { amount: 100, placed: false, active: false, cashedOut: false, win: 0 },
            2: { amount: 100, placed: false, active: false, cashedOut: false, win: 0 }
        };
    }

    placeBet(id, amount) {
        if (this.phase === 'RUNNING') return 'LOCKED';

        if (this.phase === 'IDLE') {
            this.startBetting();
        }

        this.bets[id].amount = amount;
        this.bets[id].placed = true; 
        return 'PLACED';
    }

    cancelBet(id) {
        if (this.phase === 'BETTING') {
            this.bets[id].placed = false;
            return 'CANCELLED';
        }
        return 'LOCKED';
    }

    startBetting() {
        this.phase = 'BETTING';
        this.timeRemaining = 5; // REDUCED TO 5 SECONDS
        
        this.bets[1].active = false; this.bets[1].cashedOut = false; this.bets[1].win = 0;
        this.bets[2].active = false; this.bets[2].cashedOut = false; this.bets[2].win = 0;
    }

    // --- NEW METHOD: SKIP TIMER ---
    skipTimer() {
        if (this.phase === 'BETTING') {
            // Force time to 0 to trigger startRound in update loop
            this.timeRemaining = 0; 
            return 'SKIPPED';
        }
        return 'INVALID';
    }

    resetToIdle() {
        this.phase = 'IDLE';
        this.timeRemaining = 0;
        
        this.bets[1].placed = false; this.bets[1].active = false; this.bets[1].cashedOut = false;
        this.bets[2].placed = false; this.bets[2].active = false; this.bets[2].cashedOut = false;
    }

    startRound() {
        let totalBet = 0;
        if (this.bets[1].placed) totalBet += this.bets[1].amount;
        if (this.bets[2].placed) totalBet += this.bets[2].amount;

        if (totalBet === 0) {
            this.resetToIdle();
            return 'SKIPPED';
        }

        if (this.balance < totalBet) return 'NO_FUNDS';

        this.balance -= totalBet;

        if (this.bets[1].placed) this.bets[1].active = true;
        if (this.bets[2].placed) this.bets[2].active = true;

        this.phase = 'RUNNING';
        this.multiplier = 1.00;
        this.currentGrowth = GameConfig.growthRate;
        
        const HOUSE_EDGE = 0.04; 
        const r = Math.random(); 
        let crashPoint = (1 - HOUSE_EDGE) / (1 - r);
        if (crashPoint < 1.00) crashPoint = 1.00;
        if (crashPoint > 100) crashPoint = 100;
        this.crashPoint = crashPoint;

        return 'STARTED';
    }

    cashOut(id) {
        if (this.phase === 'RUNNING' && this.bets[id].active && !this.bets[id].cashedOut) {
            const win = Math.floor(this.bets[id].amount * this.multiplier);
            this.balance += win;
            this.bets[id].cashedOut = true;
            this.bets[id].win = win;
            this.bets[id].placed = false; 

            const b1Active = this.bets[1].active && !this.bets[1].cashedOut;
            const b2Active = this.bets[2].active && !this.bets[2].cashedOut;

            if (!b1Active && !b2Active) {
                return { win: win, allCashed: true };
            }

            return { win: win, allCashed: false };
        }
        return { win: 0, allCashed: false };
    }

    crash() {
        this.phase = 'GAME_OVER';
        
        return 0;
    }

    triggerGameOver() {
        this.phase = 'GAME_OVER';
    }

    update(dt) {
        if (this.phase === 'BETTING') {
            this.timeRemaining -= (dt / 60); 
            if (this.timeRemaining <= 0) {
                this.timeRemaining = 0;
                return this.startRound(); 
            }
            return 'BETTING';
        }

        if (this.phase === 'RUNNING') {
            this.multiplier *= this.currentGrowth;
            this.currentGrowth *= GameConfig.acceleration;

            if (this.multiplier >= this.crashPoint) {
                this.multiplier = this.crashPoint;
                this.triggerGameOver();
                return 'CRASH';
            }
            return 'RUNNING';
        }
        
        return 'IDLE';
    }
}