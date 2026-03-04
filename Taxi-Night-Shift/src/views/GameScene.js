import * as PIXI from 'pixi.js';

export class GameScene extends PIXI.Container {
    constructor(appWidth, appHeight) {
        super();
        this.appWidth = appWidth;
        this.appHeight = appHeight;
        this.shakeTimer = null;
        this.activeTicker = null;
        this.isEscaping = false; 
        this.bottleThrown = false; 
        this.particles = []; // Store active particles

        this.initAssets().then(() => {
            this.initVisuals();
        });
    }

    async initAssets(onProgress) {
        const assets = await PIXI.Assets.load([
            { alias: 'city', src: '/city.png' },        
            { alias: 'road', src: '/background.png' },  
            { alias: 'store', src: '/liquor-store.png' },
            { alias: 'taxi', src: '/taxi.png' },
            { alias: 'driver', src: '/taxi-driver.png' },
            { alias: 'police', src: '/police.png' },
            { alias: 'bottle', src: '/beer-bottle.png' }
        ], onProgress);
        
        this.cityTexture = assets.city;
        this.roadTexture = assets.road;
        this.storeTexture = assets.store;
        this.taxiTexture = assets.taxi;
        this.driverTexture = assets.driver;
        this.policeTexture = assets.police;
        this.bottleTexture = assets.bottle;
        
        this.initVisuals();
    }

    initVisuals() {
        this.removeChildren();

        // 1. CITY BACKGROUND
        this.cityBg = new PIXI.TilingSprite({
            texture: this.cityTexture,
            width: this.appWidth,
            height: this.appHeight
        });
        this.addChild(this.cityBg);

        // 2. ROAD BACKGROUND
        this.roadBg = new PIXI.TilingSprite({
            texture: this.roadTexture,
            width: this.appWidth,
            height: 100 
        });
        this.addChild(this.roadBg);

        // 3. LIQUOR STORE
        if (this.storeTexture) {
            this.storeBg = new PIXI.Sprite(this.storeTexture);
            this.storeBg.anchor.set(0.5, 1); 
            this.addChild(this.storeBg);
        }

        // --- PARTICLE LAYER (Behind cars, In front of BG) ---
        this.particleContainer = new PIXI.Container();
        this.addChild(this.particleContainer);

        // --- LAYERING ---
        // 4. DRIVER
        this.driver = new PIXI.Sprite(this.driverTexture);
        this.driver.anchor.set(0.5, 1); 
        this.addChild(this.driver);

        // 5. TAXI
        this.taxi = new PIXI.Container();
        this.taxiSprite = new PIXI.Sprite(this.taxiTexture);
        this.taxiSprite.anchor.set(0.5);
        this.taxi.addChild(this.taxiSprite);
        this.addChild(this.taxi);

        // 6. BOTTLE
        this.bottle = new PIXI.Sprite(this.bottleTexture);
        this.bottle.anchor.set(0.5, 0.5); 
        this.addChild(this.bottle);

        // 7. POLICE
        this.police = new PIXI.Container();
        this.policeSprite = new PIXI.Sprite(this.policeTexture);
        this.policeSprite.anchor.set(0.5);
        this.police.addChild(this.policeSprite);

        this.sirenRed = new PIXI.Graphics().circle(-20, -50, 10).fill(0xe74c3c);
        this.sirenBlue = new PIXI.Graphics().circle(20, -50, 10).fill(0x3498db);
        this.police.addChild(this.sirenRed, this.sirenBlue);
        this.addChild(this.police);

        this.police.x = -2000; 

        // 8. CRACK OVERLAY
        this.crackContainer = new PIXI.Container();
        this.crackContainer.x = this.appWidth / 2;
        this.crackContainer.y = this.appHeight / 2;
        this.crackContainer.visible = false;
        
        const crack = new PIXI.Graphics();
        crack.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const len = 100 + Math.random() * 150;
            crack.moveTo(0, 0);
            crack.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
            if (i % 2 === 0) {
                crack.moveTo(Math.cos(angle) * (len*0.3), Math.sin(angle) * (len*0.3));
                crack.lineTo(Math.cos(angle + 0.5) * (len*0.5), Math.sin(angle + 0.5) * (len*0.5));
            }
        }
        this.crackContainer.addChild(crack);
        this.addChild(this.crackContainer);

        // 9. UI TEXT
        const mainStyle = new PIXI.TextStyle({ 
            fontFamily: 'Arial Black', fontSize: 50, fill: '#ffffff', 
            stroke: { color: '#000000', width: 6 }, 
            dropShadow: { color: '#000000', blur: 4, angle: Math.PI / 6, distance: 6 } 
        });
        
        this.multiplierText = new PIXI.Text({ text: '1.00x', style: mainStyle });
        this.multiplierText.anchor.set(0.5);
        this.multiplierText.visible = false;
        this.addChild(this.multiplierText);

        const statusStyle = new PIXI.TextStyle({ 
            fontFamily: 'Arial Black', fontSize: 24, fill: '#ffffff', 
            stroke: { color: '#000000', width: 6 }, 
            dropShadow: { color: '#000000', blur: 4, angle: Math.PI / 6, distance: 6 } 
        });

        this.statusText = new PIXI.Text({ text: '', style: statusStyle });
        this.statusText.anchor.set(0.5);
        this.addChild(this.statusText);
        
        const timerStyle = new PIXI.TextStyle({ 
            fontFamily: 'Arial Black', fontSize: 80, fill: '#f1c40f', 
            stroke: { color: '#000000', width: 8 }, 
            dropShadow: { color: '#000000', blur: 4, angle: Math.PI / 6, distance: 6 },
            align: 'center'
        });

        this.timerText = new PIXI.Text({ text: '', style: timerStyle });
        this.timerText.anchor.set(0.5);
        this.addChild(this.timerText);

        const resultStyle = new PIXI.TextStyle({ 
            fontFamily: 'Arial Black', fontSize: 50, fill: '#2ecc71', 
            stroke: { color: '#000000', width: 8 }, 
            dropShadow: { color: '#000000', blur: 6, angle: Math.PI / 6, distance: 6 },
            align: 'center', lineHeight: 60
        });
        this.resultText = new PIXI.Text({ text: '', style: resultStyle });
        this.resultText.anchor.set(0.5);
        this.resultText.visible = false;
        this.addChild(this.resultText);

        // Overlays
        this.flashOverlay = new PIXI.Graphics().rect(0,0,10,10).fill({ color: 0xFFFFFF, alpha: 0 });
        this.addChild(this.flashOverlay);
        this.fadeOverlay = new PIXI.Graphics().rect(0,0,10,10).fill({ color: 0x000000, alpha: 1 });
        this.fadeOverlay.alpha = 0; 
        this.addChild(this.fadeOverlay);

        this.layout();
    }

    layout() {
        if (!this.taxi) return;
        const isMobile = this.appWidth < 600;
        
        // --- 1. DEFINE LAYOUT GEOMETRY ---
        const roadHeight = this.appHeight * 0.25; 
        const horizonY = this.appHeight - roadHeight;
        this.laneY = horizonY + (roadHeight * 0.6); 

        // --- 2. BACKGROUNDS ---
        if (this.cityBg && this.cityTexture) {
            this.cityBg.width = this.appWidth;
            this.cityBg.height = this.appHeight;
            const scale = Math.max(this.appWidth / this.cityTexture.width, this.appHeight / this.cityTexture.height);
            this.cityBg.tileScale.set(scale);
        }

        if (this.roadBg && this.roadTexture) {
            this.roadBg.width = this.appWidth;
            this.roadBg.height = roadHeight;
            this.roadBg.y = horizonY; 
            
            const scale = this.appWidth / this.roadTexture.width;
            const scaleY = roadHeight / this.roadTexture.height;
            this.roadBg.tileScale.set(scale, scaleY); 
        }

        const baseScale = isMobile ? 0.4 : 0.7; 
        const rightAnchorX = this.appWidth * 0.7;

        // --- 3. OBJECTS ---

        // Store: Offset 20% Right (0.65) and 5% Down
        if (this.storeBg) {
            this.storeBg.scale.set(baseScale * 0.39); 
            this.storeBg.x = this.appWidth * 0.65; 
            this.storeBg.y = horizonY + (roadHeight * 0.95); 
        }

        // Taxi: Lifted 2% UP
        this.taxi.scale.set(baseScale * 0.85); 
        
        // Driver: 20% Right (0.60) and 2% UP
        if (this.driver) {
            this.driver.scale.set(baseScale * 0.45); 
            this.driver.x = this.appWidth * 0.60; 
            this.driver.y = horizonY + (roadHeight * 0.98); 
        }

        // Bottle
        this.bottle.scale.set(baseScale * 0.1); 
        
        // Police: 1% Down
        this.police.scale.set(baseScale * 1.6); 
        this.police.y = this.laneY + (this.appHeight * 0.01);

        // UI Positioning
        this.multiplierText.x = this.appWidth / 2; 
        this.multiplierText.y = this.appHeight * 0.2;
        this.statusText.x = this.appWidth / 2; 
        this.statusText.y = this.appHeight * 0.2 + 60;
        this.timerText.x = this.appWidth / 2; 
        this.timerText.y = this.appHeight * 0.2 + 100;
        this.resultText.x = this.appWidth / 2;
        this.resultText.y = this.appHeight / 2;

        this.crackContainer.x = this.appWidth / 2;
        this.crackContainer.y = this.appHeight / 2;
        this.crackContainer.scale.set(isMobile ? 0.8 : 1.5);

        this.flashOverlay.clear().rect(0,0,this.appWidth, this.appHeight).fill({ color: 0xFFFFFF, alpha: 0 });
        this.fadeOverlay.clear().rect(0,0,this.appWidth, this.appHeight).fill({ color: 0x000000, alpha: 1 });
    }

    // --- PARTICLE SYSTEM METHODS ---
    spawnSmoke(x, y, scale) {
        const particle = new PIXI.Graphics();
        // Brighter grey and more opaque
        particle.rect(-6, -6, 12, 12).fill({ color: 0x999999, alpha: 0.8 });
        particle.x = x;
        particle.y = y;
        particle.scale.set(scale * (0.6 + Math.random() * 0.6)); 
        particle.rotation = Math.random() * Math.PI;
        
        particle.vx = -3 - Math.random() * 3; 
        particle.vy = -0.5 - Math.random() * 1.0; 
        particle.life = 1.0; 
        particle.decay = 0.015 + Math.random() * 0.02; 
        particle.isSmoke = true;

        this.particleContainer.addChild(particle);
        this.particles.push(particle);
    }

    spawnWind(y, scale) {
        const particle = new PIXI.Graphics();
        const width = 100 + Math.random() * 150; 
        // Thicker lines
        particle.rect(0, 0, width, 4).fill({ color: 0xFFFFFF, alpha: 0.5 });
        particle.x = this.appWidth + 50; 
        particle.y = y;
        particle.scale.set(scale);
        
        particle.vx = -20 - Math.random() * 15; 
        particle.life = 1.0;
        particle.isWind = true;

        this.particleContainer.addChild(particle);
        this.particles.push(particle);
    }

    spawnDebris(x, y, scale) {
        const particle = new PIXI.Graphics();
        const colors = [0xFFFF00, 0xFF8800, 0xFFFFFF]; 
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.rect(-3, -3, 6, 6).fill({ color: color, alpha: 1 });
        particle.x = x;
        particle.y = y;
        particle.scale.set(scale * (0.3 + Math.random() * 0.4));

        particle.vx = -10 - Math.random() * 15; 
        particle.vy = -2 - Math.random() * 4;   
        particle.gravity = 0.2;                 
        particle.life = 1.0;
        particle.decay = 0.04 + Math.random() * 0.05; 
        particle.isDebris = true;

        this.particleContainer.addChild(particle);
        this.particles.push(particle);
    }

    // NEW PARTICLE TYPE: Birds
    spawnBird(scale) {
        const particle = new PIXI.Graphics();
        // Simple dark ellipse for distant bird
        particle.ellipse(0, 0, 3, 2).fill({ color: 0x222222, alpha: 0.8 });
        particle.x = this.appWidth + 10;
        // Random height in top 30% of screen
        particle.y = Math.random() * this.appHeight * 0.3;
        particle.scale.set(scale * (0.5 + Math.random() * 0.5));

        particle.vx = -1 - Math.random() * 2; // Slow left movement
        particle.vy = (Math.random() - 0.5) * 0.2; // Slight vertical bobbing
        particle.life = 1.0;
        particle.isBird = true;

        this.particleContainer.addChild(particle);
        this.particles.push(particle);
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.x += p.vx;
            if (p.vy !== undefined) p.y += p.vy;
            
            if (p.isSmoke) {
                p.rotation += 0.05;
                p.scale.x *= 1.015; 
                p.scale.y *= 1.015;
                p.life -= p.decay;
                p.alpha = p.life * 0.8;
            } else if (p.isDebris) {
                p.vy += p.gravity; 
                p.rotation += 0.2; 
                p.life -= p.decay;
                p.scale.x *= 0.95; 
                p.scale.y *= 0.95;
            } else if (p.isWind) {
                if (p.x < -300) p.life = 0; 
            } else if (p.isBird) {
                if (p.x < -10) p.life = 0; // Kill when off-screen left
            }

            if (p.life <= 0) {
                this.particleContainer.removeChild(p);
                this.particles.splice(i, 1);
            }
        }
    }

    setIdleState() {
        this.reset();
        
        this.cityBg.visible = true;
        this.roadBg.visible = true;
        this.storeBg.visible = true;    
        
        const scale = this.appWidth < 600 ? 0.4 : 0.7;
        const rightAnchorX = this.appWidth * 0.7;

        const roadHeight = this.appHeight * 0.25; 
        const horizonY = this.appHeight - roadHeight;
        const laneY = horizonY + (roadHeight * 0.6);

        if (this.storeBg) {
            this.storeBg.scale.set(scale * 0.39);
            this.storeBg.x = this.appWidth * 0.65;
            this.storeBg.y = horizonY + (roadHeight * 0.95);
        }

        this.taxi.x = rightAnchorX; 
        this.taxi.y = laneY - (this.appHeight * 0.02); 
        
        this.driver.visible = true;
        this.driver.alpha = 1;
        this.driver.x = this.appWidth * 0.60; 
        this.driver.y = horizonY + (roadHeight * 0.98); 
        
        this.bottle.visible = false; 
        this.bottle.alpha = 1;
        this.bottle.rotation = 0;
        this.bottle.scale.set(scale * 0.1); 
        this.bottleThrown = false; 
        this.bottle.x = this.driver.x + (15 * scale); 
        this.bottle.y = this.driver.y - (25 * scale); 
        
        this.police.x = -2000; 
        this.crackContainer.visible = false;

        this.statusText.text = "WAITING FOR NEXT RIDE...";
        this.statusText.style.fill = 0xaaaaaa;
        this.statusText.visible = true;
        this.multiplierText.visible = false;
        this.timerText.visible = false;
        this.resultText.visible = false;
    }

    update(multiplier, phase, timeRemaining) {
        // Always update particles
        this.updateParticles();

        if (!this.cityBg) return;

        // Spawn birds randomly in all phases
        if (Math.random() < 0.005) {
            const scale = this.appWidth < 600 ? 0.4 : 0.7;
            this.spawnBird(scale);
        }

        // --- IDLE ---
        if (phase === 'IDLE') {
            this.timerText.visible = false;
            this.multiplierText.visible = false;
            this.statusText.visible = true;
            this.statusText.text = "WAITING FOR NEXT RIDE...";
            this.police.x = -2000; 

            // Taxi Bobbing
            const taxiBaseY = this.laneY - (this.appHeight * 0.02);
            this.taxi.y = taxiBaseY + (Math.sin(Date.now() / 60) * 1); 
            
            // ** ADDED SMOKE HERE **
            if (Math.random() < 0.15) {
                const scale = this.appWidth < 600 ? 0.4 : 0.7;
                // *** UPDATED: Offset +25 Y ***
                this.spawnSmoke(this.taxi.x - (85 * scale), this.taxi.y + (25 * scale) + (this.appHeight * 0.02), scale);
            }

            if (!this.bottleThrown) {
                this.bottle.rotation = 0;
                const scale = this.appWidth < 600 ? 0.4 : 0.7;
                this.bottle.y = this.driver.y - (25 * scale);
            }
        }

        // --- BETTING ---
        else if (phase === 'BETTING') {
            this.statusText.visible = false;
            this.multiplierText.visible = false;
            this.timerText.visible = true;
            this.timerText.text = Math.ceil(timeRemaining);

            const targetX = this.appWidth * 0.3; 
            this.police.x += (targetX - this.police.x) * 0.05;

            // Police Bobbing
            const policeBaseY = this.laneY + (this.appHeight * 0.01);
            this.police.y = policeBaseY + (Math.sin(Date.now() / 50) * 2);

            // Taxi Engine Rumble
            const taxiBaseY = this.laneY - (this.appHeight * 0.02);
            this.taxi.y = taxiBaseY + (Math.sin(Date.now() / 50) * 2); 

            // Spawn Idle Smoke (Offset -85)
            if (Math.random() < 0.15) {
                const scale = this.appWidth < 600 ? 0.4 : 0.7;
                // *** UPDATED: Offset +25 Y ***
                this.spawnSmoke(this.taxi.x - (85 * scale), this.taxi.y + (25 * scale) + (this.appHeight * 0.02), scale);
                if (this.police.x > 0) {
                    this.spawnSmoke(this.police.x - (60 * scale), this.police.y + (10 * scale) + (this.appHeight * 0.02), scale);
                }
            }

            // --- BOTTLE THROW ---
            if (timeRemaining < 3.5 && !this.bottleThrown) {
                this.bottleThrown = true;
                this.bottle.visible = true; 
                this.bottle.alpha = 1;
            }

            if (this.bottleThrown && this.bottle.visible) {
                const centerX = this.appWidth / 2;
                const centerY = this.appHeight / 2;
                this.bottle.x += (centerX - this.bottle.x) * 0.08; 
                this.bottle.y += (centerY - this.bottle.y) * 0.08;
                this.bottle.scale.x *= 1.04; 
                this.bottle.scale.y *= 1.04;
                this.bottle.rotation += 0.2;

                if (this.bottle.scale.x > 2.0) this.bottle.alpha -= 0.15; 
                if (this.bottle.scale.x > 3.0 && !this.crackContainer.visible) {
                    this.crackContainer.visible = true; 
                    this.crackContainer.alpha = 1;
                    this.flashOverlay.alpha = 0.5;
                }
                if (this.bottle.alpha <= 0) this.bottle.visible = false; 
            }

            if (timeRemaining < 2.5 && this.driver.alpha > 0) {
                this.driver.alpha -= 0.1;
                this.driver.x += 5; 
            }

            if (this.police.x > targetX - 200) {
                 if (Math.floor(Date.now() / 100) % 2 === 0) {
                    this.sirenRed.alpha = 1; this.sirenBlue.alpha = 0.3;
                    this.flashOverlay.alpha = Math.max(this.flashOverlay.alpha, 0.1); this.flashOverlay.tint = 0xFF0000;
                } else {
                    this.sirenRed.alpha = 0.3; this.sirenBlue.alpha = 1;
                    this.flashOverlay.alpha = Math.max(this.flashOverlay.alpha, 0.1); this.flashOverlay.tint = 0x0000FF;
                }
            } else {
                if (this.bottle.visible) this.flashOverlay.alpha = 0;
                else this.flashOverlay.alpha *= 0.9; 
            }
        }

        // --- RUNNING ---
        else if (phase === 'RUNNING' || this.isEscaping) {
            this.timerText.visible = false;
            this.statusText.visible = false;
            this.flashOverlay.alpha = 0;
            this.driver.alpha = 0; 
            this.bottle.visible = false;
            this.crackContainer.visible = false; 

            this.multiplierText.visible = true;
            this.multiplierText.text = multiplier.toFixed(2) + "x";

            let speed = 15 + (multiplier * 5);
            if (this.isEscaping) speed = 100;
            
            this.roadBg.tilePosition.x -= speed;
            this.cityBg.tilePosition.x -= speed * 0.1; 

            if (this.storeBg.visible) {
                this.storeBg.x -= speed; 
                if (this.storeBg.x < -500) this.storeBg.visible = false;
            }

            const driveX = this.appWidth * 0.7;
            this.taxi.x += (driveX - this.taxi.x) * 0.05;

            // TAXI STABLE (No bounce)
            const taxiTargetY = this.laneY - (this.appHeight * 0.02);
            this.taxi.y += (taxiTargetY - this.taxi.y) * 0.05;
            
            if (!this.isEscaping) {
                const fixedX = this.appWidth * 0.3; 
                this.police.x += (fixedX - this.police.x) * 0.1; 
                
                // POLICE STABLE (No bounce)
                const policeTargetY = this.laneY + (this.appHeight * 0.01);
                this.police.y += (policeTargetY - this.police.y) * 0.1;
            }
            
            const flashSpeed = Math.max(50, 200 - (multiplier * 10));
            if (Math.floor(Date.now() / flashSpeed) % 2 === 0) {
                this.sirenRed.alpha = 1; this.sirenBlue.alpha = 0.3;
            } else {
                this.sirenRed.alpha = 0.3; this.sirenBlue.alpha = 1;
            }

            // SPAWN PARTICLES (High Volume during chase)
            const scale = this.appWidth < 600 ? 0.4 : 0.7;
            
            // More Smoke (Offset -95)
            if (Math.random() < 0.5) { 
                // *** UPDATED: Offset +35 Y ***
                this.spawnSmoke(this.taxi.x - (95 * scale), this.taxi.y + (35 * scale) + (this.appHeight * 0.02), scale);
                if (!this.isEscaping) {
                    this.spawnSmoke(this.police.x - (70 * scale), this.police.y + (20 * scale) + (this.appHeight * 0.02), scale);
                }
            }
            // More Wind
            if (Math.random() < 0.2) { 
                const windY = this.appHeight * (0.3 + Math.random() * 0.4); 
                this.spawnWind(windY, scale);
            }
            // Debris/Sparks kicking up from tires
            if (Math.random() < 0.6) {
                 this.spawnDebris(this.taxi.x - (20 * scale), this.taxi.y + (25 * scale), scale);
                 if (!this.isEscaping) {
                     this.spawnDebris(this.police.x - (20 * scale), this.police.y + (25 * scale), scale);
                 }
            }
        }
    }

    transitionToIdle(onComplete) {
        let alpha = 0;
        let phase = 'OUT';
        const fadeTicker = (ticker) => {
            if (phase === 'OUT') {
                alpha += 0.05;
                this.fadeOverlay.alpha = alpha;
                if (alpha >= 1) {
                    phase = 'IN';
                    this.setIdleState(); 
                }
            } else {
                alpha -= 0.05;
                this.fadeOverlay.alpha = alpha;
                if (alpha <= 0) {
                    this.fadeOverlay.alpha = 0;
                    PIXI.Ticker.shared.remove(fadeTicker);
                    if (onComplete) onComplete();
                }
            }
        };
        PIXI.Ticker.shared.add(fadeTicker);
    }

    setGameOver(type, value, extra) {
        if (type === 'CRASH') this.triggerCrash();
        else if (type === 'ESCAPE') this.triggerEscape(value, extra);
        else if (type === 'WIN_EFFECT') this.showWinEffect(value);
    }

    triggerCrash() {
        if (this.activeTicker) PIXI.Ticker.shared.remove(this.activeTicker);
        this.activeTicker = (ticker) => {
            this.police.x += 35; 
            const collisionGap = this.appWidth < 600 ? 100 : 200;
            if (this.police.x >= this.taxi.x - collisionGap) { 
                this.police.x = this.taxi.x - collisionGap;
                this.statusText.text = "OOH, BUSTED!";
                this.statusText.style.fill = 0xe74c3c;
                this.statusText.visible = true;
                PIXI.Ticker.shared.remove(this.activeTicker);
                this.activeTicker = null;
            }
        };
        PIXI.Ticker.shared.add(this.activeTicker);
    }

    triggerEscape(finalMultiplier, totalWin) {
        this.isEscaping = true;
        if (this.activeTicker) PIXI.Ticker.shared.remove(this.activeTicker);
        
        this.resultText.text = `ESCAPED!\n+ ${totalWin.toLocaleString()} RSD`;
        this.resultText.visible = true;
        this.resultText.scale.set(0);

        this.statusText.visible = false; 

        let frame = 0;
        this.activeTicker = (ticker) => {
            frame++;
            this.taxi.x += 25; 
            this.police.x -= 10;
            
            if (frame < 20) {
                this.resultText.scale.x += (1 - this.resultText.scale.x) * 0.2;
                this.resultText.scale.y += (1 - this.resultText.scale.y) * 0.2;
            }

            if (this.taxi.x > this.appWidth + 400) {
                this.isEscaping = false; 
                PIXI.Ticker.shared.remove(this.activeTicker);
                this.activeTicker = null;
            }
        };
        PIXI.Ticker.shared.add(this.activeTicker);
    }

    showWinEffect(amount) {
        const winStyle = new PIXI.TextStyle({ 
            fontFamily: 'Arial Black', fontSize: 40, fill: '#2ecc71', 
            stroke: { color: '#000000', width: 4 }, 
            dropShadow: { color: '#000000', blur: 4, angle: Math.PI / 6, distance: 6 } 
        });

        const winText = new PIXI.Text({ text: `+ ${amount}`, style: winStyle });
        winText.anchor.set(0.5);
        winText.x = this.taxi.x;
        winText.y = this.taxi.y - 50;
        this.addChild(winText);
        let life = 0;
        const textTicker = (ticker) => {
            life++;
            winText.y -= 2; winText.alpha -= 0.02; 
            if (life > 50) {
                this.removeChild(winText);
                PIXI.Ticker.shared.remove(textTicker);
            }
        };
        PIXI.Ticker.shared.add(textTicker);
    }

    reset() {
        if (this.activeTicker) { PIXI.Ticker.shared.remove(this.activeTicker); this.activeTicker = null; }
        if (this.shakeTimer) { clearInterval(this.shakeTimer); this.shakeTimer = null; }
        this.x = 0; this.y = 0;
        this.isEscaping = false; 
        // Clear particles on reset
        for (const p of this.particles) {
            this.particleContainer.removeChild(p);
        }
        this.particles = [];

        if (this.moneyBag) this.moneyBag.visible = false;
        if (this.flashOverlay) this.flashOverlay.alpha = 0;
        this.resultText.visible = false;
        
        this.layout();
        this.police.x = -2000; 
        this.taxi.tint = 0xFFFFFF;
    }
}