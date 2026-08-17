// 2D Pixel Art Office Canvas Engine with Realistic Human Employees (60 FPS)
class OfficeRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.agents = SWARM_AGENTS.map(agent => ({
      ...agent,
      currentX: agent.chairPos.x,
      currentY: agent.chairPos.y,
      targetX: agent.chairPos.x,
      targetY: agent.chairPos.y,
      speed: 1.4,
      animFrame: 0,
      speechText: null,
      speechTimer: 0,
      facing: 'down', // 'down', 'up', 'left', 'right'
      blinkTimer: Math.floor(Math.random() * 120),
      isBlinking: false
    }));

    this.mouse = { x: 0, y: 0, hoveredAgent: null };
    this.time = 0;

    this.initEvents();
    this.startLoop();
  }

  initEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;

      this.checkHover();
    });

    this.canvas.addEventListener('click', () => {
      if (this.mouse.hoveredAgent) {
        audioFX.playBlip(600, 'triangle', 0.1);
        openAgentModal(this.mouse.hoveredAgent.id);
      }
    });

    // Wandering, coffee breaks, & whiteboard brainstorming loop
    setInterval(() => {
      this.triggerAutonomousActivities();
    }, 8000);
  }

  checkHover() {
    let hovered = null;
    for (const ag of this.agents) {
      const dist = Math.hypot(this.mouse.x - ag.currentX, this.mouse.y - (ag.currentY - 12));
      if (dist < 32) {
        hovered = ag;
        break;
      }
    }

    this.mouse.hoveredAgent = hovered;
    const card = document.getElementById('agent-hover-card');

    if (hovered) {
      this.canvas.style.cursor = 'pointer';
      card.classList.remove('hidden');
      document.getElementById('hover-avatar').innerText = hovered.avatar;
      document.getElementById('hover-name').innerText = `${hovered.name} (${hovered.title})`;
      document.getElementById('hover-status').innerText = hovered.state;
      document.getElementById('hover-task').innerText = hovered.currentTask;

      const rect = this.canvas.getBoundingClientRect();
      const cardX = (hovered.currentX / this.canvas.width) * rect.width + 20;
      const cardY = (hovered.currentY / this.canvas.height) * rect.height - 50;
      card.style.left = `${Math.min(cardX, rect.width - 260)}px`;
      card.style.top = `${Math.max(cardY, 10)}px`;
    } else {
      this.canvas.style.cursor = 'default';
      card.classList.add('hidden');
    }
  }

  triggerAutonomousActivities() {
    const workingAgents = this.agents.filter(a => a.state === 'WORKING');
    if (workingAgents.length === 0) return;

    const agent = workingAgents[Math.floor(Math.random() * workingAgents.length)];
    const roll = Math.random();

    if (roll < 0.35) {
      // Walk to Coffee Pantry
      agent.state = 'WALKING';
      agent.targetX = agent.pantryPos.x + (Math.random() * 30 - 15);
      agent.targetY = agent.pantryPos.y + (Math.random() * 20 - 10);
      agent.speechText = '☕ Bikin kopi dulu...';
      agent.speechTimer = 180;
      audioFX.playBlip(350, 'square', 0.05);

      setTimeout(() => {
        agent.state = 'COFFEE';
        agent.speechText = '⚡ Recharging ide!';
        setTimeout(() => {
          // Walk back to desk
          agent.state = 'WALKING';
          agent.targetX = agent.chairPos.x;
          agent.targetY = agent.chairPos.y;
          setTimeout(() => {
            agent.state = 'WORKING';
            agent.speechText = '💻 Lanjut gas ngerjain!';
            agent.speechTimer = 120;
          }, 3200);
        }, 4000);
      }, 3000);
    } else if (roll < 0.6) {
      // Walk to Whiteboard Brainstorming
      agent.state = 'WALKING';
      agent.targetX = agent.whiteboardPos.x + (Math.random() * 40 - 20);
      agent.targetY = agent.whiteboardPos.y;
      agent.speechText = '📝 Diskusi strategi SEO...';
      agent.speechTimer = 180;

      setTimeout(() => {
        agent.state = 'WHITEBOARD';
        agent.speechText = '💡 Ketemu angle baru!';
        setTimeout(() => {
          agent.state = 'WALKING';
          agent.targetX = agent.chairPos.x;
          agent.targetY = agent.chairPos.y;
          setTimeout(() => {
            agent.state = 'WORKING';
            agent.speechText = '🚀 Eksekusi strategi!';
            agent.speechTimer = 120;
          }, 3000);
        }, 4500);
      }, 2800);
    }
  }

  showSpeech(agentId, text) {
    const agent = this.agents.find(a => a.id === agentId);
    if (agent) {
      agent.speechText = text;
      agent.speechTimer = 240;
    }
  }

  startLoop() {
    const render = () => {
      this.time++;
      this.updateAgents();
      this.draw();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  updateAgents() {
    for (const ag of this.agents) {
      // Movement interpolation
      const dx = ag.targetX - ag.currentX;
      const dy = ag.targetY - ag.currentY;
      const dist = Math.hypot(dx, dy);

      if (dist > 2) {
        ag.currentX += (dx / dist) * ag.speed;
        ag.currentY += (dy / dist) * ag.speed;
        ag.animFrame += 0.22;

        if (Math.abs(dx) > Math.abs(dy)) {
          ag.facing = dx > 0 ? 'right' : 'left';
        } else {
          ag.facing = dy > 0 ? 'down' : 'up';
        }
      } else {
        ag.currentX = ag.targetX;
        ag.currentY = ag.targetY;
        if (ag.state === 'WORKING') {
          ag.animFrame += 0.15;
          ag.facing = 'up';
        }
      }

      // Blink animation
      ag.blinkTimer++;
      if (ag.blinkTimer > 150) {
        ag.isBlinking = true;
        if (ag.blinkTimer > 160) {
          ag.isBlinking = false;
          ag.blinkTimer = 0;
        }
      }

      if (ag.speechTimer > 0) {
        ag.speechTimer--;
        if (ag.speechTimer === 0) ag.speechText = null;
      }
    }
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Office Floor Tiles
    this.drawFloor();

    // 2. Draw Walls, Whiteboard, & Windows
    this.drawWalls();

    // 3. Draw Server Room (Top Left)
    this.drawServerRoom();

    // 4. Draw Coffee Pantry (Top Right)
    this.drawPantry();

    // 5. Draw Furniture / Desks
    this.drawDesks();

    // 6. Draw Pixel Human Employees
    this.drawHumanAgents();

    // 7. Draw Speech Bubbles
    this.drawSpeechBubbles();
  }

  drawFloor() {
    const { ctx, canvas } = this;
    const tileSize = 32;

    for (let x = 0; x < canvas.width; x += tileSize) {
      for (let y = 100; y < canvas.height; y += tileSize) {
        const isAlternate = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isAlternate ? '#0d1117' : '#111622';
        ctx.fillRect(x, y, tileSize, tileSize);

        ctx.strokeStyle = '#182030';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // Workstation Carpet division
    ctx.fillStyle = 'rgba(0, 240, 255, 0.03)';
    ctx.fillRect(100, 180, 560, 310);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(100, 180, 560, 310);
    ctx.setLineDash([]);
  }

  drawWalls() {
    const { ctx, canvas } = this;
    // Top wall
    ctx.fillStyle = '#161c28';
    ctx.fillRect(0, 0, canvas.width, 100);

    // Wall baseboard
    ctx.fillStyle = '#222d42';
    ctx.fillRect(0, 96, canvas.width, 6);

    // Central SEO Whiteboard
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(360, 15, 240, 65);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.strokeRect(360, 15, 240, 65);

    // Whiteboard Content
    ctx.font = '7px "Press Start 2P"';
    ctx.fillStyle = '#0284c7';
    ctx.textAlign = 'center';
    ctx.fillText('📋 TEPATLASER STRATEGY BOARD', 480, 32);

    ctx.font = '8px "JetBrains Mono"';
    ctx.fillStyle = '#16a34a';
    ctx.fillText('✔ 104 SEO Landing Hubs [LIVE]', 480, 46);

    ctx.fillStyle = '#dc2626';
    ctx.fillText('✖ Google Ads Boncos Blocked', 480, 58);

    ctx.fillStyle = '#6b7280';
    ctx.fillText('⏰ Daily Cloud Publish: 07:00 WIB', 480, 70);

    // Windows with moving digital cyber rain
    ctx.fillStyle = '#050a14';
    ctx.fillRect(180, 20, 120, 54);
    ctx.strokeStyle = '#2a3b5c';
    ctx.strokeRect(180, 20, 120, 54);

    ctx.strokeStyle = '#1a273f';
    ctx.beginPath();
    ctx.moveTo(240, 20); ctx.lineTo(240, 74);
    ctx.moveTo(180, 47); ctx.lineTo(300, 47);
    ctx.stroke();

    const glow = Math.sin(this.time * 0.05) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(0, 240, 255, ${glow * 0.8})`;
    ctx.fillRect(210, 35, 4, 4);
    ctx.fillRect(270, 40, 3, 3);
  }

  drawServerRoom() {
    const { ctx } = this;
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(20, 20, 120, 70);
    ctx.strokeStyle = '#9d4edd';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 120, 70);

    ctx.font = '7px "Press Start 2P"';
    ctx.fillStyle = '#9d4edd';
    ctx.textAlign = 'center';
    ctx.fillText('VPS 163.61.44.41', 80, 34);

    for (let r = 0; r < 3; r++) {
      ctx.fillStyle = '#141824';
      ctx.fillRect(30, 42 + r * 14, 100, 10);
      
      const ledG = (this.time + r * 15) % 30 < 15;
      const ledC = (this.time + r * 20) % 40 < 20;

      ctx.fillStyle = ledG ? '#00ff66' : '#004411';
      ctx.fillRect(35, 45 + r * 14, 4, 4);

      ctx.fillStyle = ledC ? '#00f0ff' : '#003355';
      ctx.fillRect(43, 45 + r * 14, 4, 4);

      ctx.fillStyle = '#ffe600';
      ctx.fillRect(51, 45 + r * 14, 4, 4);
    }
  }

  drawPantry() {
    const { ctx } = this;
    ctx.fillStyle = '#121722';
    ctx.fillRect(740, 20, 190, 80);
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 1;
    ctx.strokeRect(740, 20, 190, 80);

    ctx.font = '7px "Press Start 2P"';
    ctx.fillStyle = '#ffe600';
    ctx.textAlign = 'center';
    ctx.fillText('☕ AI COFFEE PANTRY', 835, 34);

    // Coffee Machine
    ctx.fillStyle = '#333b4d';
    ctx.fillRect(755, 45, 30, 40);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(762, 52, 16, 8);
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(765, 72, 10, 8);

    // Water Dispenser
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(800, 40, 20, 45);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(803, 45, 14, 15);
  }

  drawDesks() {
    const { ctx } = this;

    this.agents.forEach(agent => {
      const { x, y } = agent.deskPos;

      // Desk Surface
      ctx.fillStyle = '#1a2233';
      ctx.fillRect(x - 45, y - 25, 90, 45);
      ctx.strokeStyle = agent.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 45, y - 25, 90, 45);

      // Dual Computer Monitors
      ctx.fillStyle = '#080a10';
      ctx.fillRect(x - 30, y - 20, 32, 22);
      ctx.strokeStyle = '#3a4a6b';
      ctx.strokeRect(x - 30, y - 20, 32, 22);

      const screenGlow = Math.sin(this.time * 0.1) * 0.2 + 0.8;
      ctx.fillStyle = agent.color;
      ctx.globalAlpha = screenGlow;
      ctx.fillRect(x - 28, y - 18, 28, 18);
      ctx.globalAlpha = 1.0;

      // Secondary Vertical Monitor
      ctx.fillStyle = '#080a10';
      ctx.fillRect(x + 8, y - 22, 18, 26);
      ctx.strokeStyle = '#3a4a6b';
      ctx.strokeRect(x + 8, y - 22, 18, 26);

      ctx.fillStyle = '#00ff66';
      ctx.fillRect(x + 10, y - 20, 14, 22);

      // Keyboard & Mouse
      ctx.fillStyle = '#2f3b52';
      ctx.fillRect(x - 25, y + 6, 22, 8);
      ctx.fillRect(x + 3, y + 8, 6, 6);

      // Coffee Mug on Desk with rising steam particles
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + 28, y + 4, 8, 10);
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(x + 29, y + 5, 6, 3);
      if (this.time % 20 < 10) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(x + 31, y - 2, 2, 4);
      }

      // Nameplate on Desk
      ctx.fillStyle = '#080c14';
      ctx.fillRect(x - 35, y + 14, 70, 10);
      ctx.font = '6px "Press Start 2P"';
      ctx.fillStyle = agent.color;
      ctx.textAlign = 'center';
      ctx.fillText(agent.name, x, y + 22);
    });
  }

  drawHumanAgents() {
    const { ctx } = this;

    this.agents.forEach(agent => {
      const x = agent.currentX;
      const y = agent.currentY;
      const app = agent.appearance;

      // Selection Halo
      ctx.strokeStyle = agent.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y - 10, 20, 0, Math.PI * 2);
      ctx.stroke();

      if (agent.state === 'WORKING') {
        this.drawSeatedHuman(ctx, agent, x, y, app);
      } else {
        this.drawWalkingHuman(ctx, agent, x, y, app);
      }
    });
  }

  // Draw Human Seated at Office Chair Typing
  drawSeatedHuman(ctx, agent, x, y, app) {
    const bob = Math.sin(this.time * 0.25 + agent.deskPos.x) * 1.5;
    const typeCycle = Math.sin(this.time * 0.5);

    // 1. Office Chair Backrest
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(x - 14, y - 16, 28, 22, 4);
    ctx.fill();

    // 2. Body / Torso (Shirt / Blouse)
    ctx.fillStyle = app.shirtColor;
    ctx.fillRect(x - 8, y - 6 + bob, 16, 14);

    // Collar / Tie / Details
    if (agent.gender === 'female') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 3, y - 6 + bob, 6, 4); // Blouse collar
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 1, y - 4 + bob, 2, 8); // Tie/seam
    }

    // 3. Hands typing on keyboard
    ctx.fillStyle = app.skinColor;
    // Left hand
    ctx.fillRect(x - 10, y + 4 + bob + (typeCycle > 0 ? -2 : 1), 5, 4);
    // Right hand
    ctx.fillRect(x + 5, y + 4 + bob + (typeCycle <= 0 ? -2 : 1), 5, 4);

    // 4. Head & Neck
    ctx.fillStyle = app.skinColor;
    ctx.fillRect(x - 6, y - 18 + bob, 12, 12); // Face

    // Eyes (with blinking)
    if (!agent.isBlinking) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 4, y - 13 + bob, 2, 2);
      ctx.fillRect(x + 2, y - 13 + bob, 2, 2);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x - 4, y - 12 + bob, 2, 1);
      ctx.fillRect(x + 2, y - 12 + bob, 2, 1);
    }

    // 5. Hair & Accessories
    this.drawHairAndAccessories(ctx, agent, x, y + bob, app);

    // Name badge below chair
    ctx.font = '7px "JetBrains Mono"';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(`${agent.name} (${agent.avatar})`, x, y + 26);
  }

  // Draw Human Walking / Standing
  drawWalkingHuman(ctx, agent, x, y, app) {
    const walkAnim = Math.sin(agent.animFrame);
    const legOffset = walkAnim * 5;
    const bodyBob = Math.abs(Math.sin(agent.animFrame)) * 2;

    // 1. Legs & Shoes
    ctx.fillStyle = app.pantsColor;
    // Left Leg
    ctx.fillRect(x - 6, y - 4 - bodyBob, 4, 12 + legOffset);
    // Right Leg
    ctx.fillRect(x + 2, y - 4 - bodyBob, 4, 12 - legOffset);

    // Shoes
    ctx.fillStyle = '#020617';
    ctx.fillRect(x - 7, y + 8 - bodyBob + legOffset, 6, 3);
    ctx.fillRect(x + 1, y + 8 - bodyBob - legOffset, 6, 3);

    // 2. Torso / Shirt
    ctx.fillStyle = app.shirtColor;
    ctx.fillRect(x - 8, y - 18 - bodyBob, 16, 15);

    // 3. Arms & Items carried
    ctx.fillStyle = app.skinColor;
    // Arm swing
    const armSwing = Math.cos(agent.animFrame) * 4;
    ctx.fillRect(x - 11, y - 16 - bodyBob + armSwing, 3, 10);
    ctx.fillRect(x + 8, y - 16 - bodyBob - armSwing, 3, 10);

    // Holding Coffee Cup or Clipboard
    if (agent.state === 'COFFEE') {
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(x + 9, y - 10 - bodyBob - armSwing, 5, 6);
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + 9, y - 12 - bodyBob - armSwing, 6, 8); // Document clipboard
    }

    // 4. Head & Face
    ctx.fillStyle = app.skinColor;
    ctx.fillRect(x - 6, y - 30 - bodyBob, 12, 12);

    // Eyes
    if (!agent.isBlinking) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 4, y - 25 - bodyBob, 2, 2);
      ctx.fillRect(x + 2, y - 25 - bodyBob, 2, 2);
    }

    // 5. Hair & Accessories
    this.drawHairAndAccessories(ctx, agent, x, y - 12 - bodyBob, app);

    // Name badge below
    ctx.font = '7px "JetBrains Mono"';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(`${agent.name} (${agent.avatar})`, x, y + 18);
  }

  drawHairAndAccessories(ctx, agent, x, y, app) {
    ctx.fillStyle = app.hairColor;

    if (app.hairStyle === 'bob') {
      // Female Bob Hair
      ctx.fillRect(x - 7, y - 20, 14, 5); // Top
      ctx.fillRect(x - 8, y - 18, 3, 10); // Left lock
      ctx.fillRect(x + 5, y - 18, 3, 10); // Right lock
      ctx.fillRect(x - 5, y - 16, 10, 2); // Bangs
    } else if (app.hairStyle === 'ponytail') {
      // Female Ponytail Hair
      ctx.fillRect(x - 7, y - 20, 14, 5);
      ctx.fillRect(x - 8, y - 18, 3, 8);
      ctx.fillRect(x + 5, y - 18, 3, 8);
      // Ponytail tail on right
      ctx.fillRect(x + 6, y - 22, 5, 12);
      ctx.fillStyle = '#ec4899'; // Ribbon
      ctx.fillRect(x + 5, y - 21, 3, 3);
    } else if (app.hairStyle === 'short') {
      // Male Short Neat Hair
      ctx.fillRect(x - 7, y - 21, 14, 5);
      ctx.fillRect(x - 7, y - 18, 3, 4);
      ctx.fillRect(x + 4, y - 18, 3, 4);
    } else if (app.hairStyle === 'undercut') {
      // Male Modern Undercut
      ctx.fillRect(x - 6, y - 22, 12, 6);
      ctx.fillRect(x - 7, y - 19, 2, 4);
    } else if (app.hairStyle === 'cap') {
      // Backward Stylish Cap
      ctx.fillStyle = app.hairColor;
      ctx.fillRect(x - 7, y - 21, 14, 6);
      ctx.fillRect(x - 9, y - 18, 3, 3); // Visor backwards
    }

    // Accessories
    if (app.accessory === 'glasses') {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 5, y - 14, 4, 3);
      ctx.strokeRect(x + 1, y - 14, 4, 3);
      ctx.beginPath();
      ctx.moveTo(x - 1, y - 13); ctx.lineTo(x + 1, y - 13);
      ctx.stroke();
    } else if (app.accessory === 'headset') {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y - 15, 8, Math.PI, 0); // Headband
      ctx.stroke();
      // Mic to mouth
      ctx.fillStyle = '#00ff66';
      ctx.fillRect(x + 2, y - 10, 3, 2);
    } else if (app.accessory === 'headphones') {
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(x - 8, y - 17, 3, 6);
      ctx.fillRect(x + 5, y - 17, 3, 6);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 16, 7, Math.PI, 0);
      ctx.stroke();
    }
  }

  drawSpeechBubbles() {
    const { ctx } = this;

    this.agents.forEach(agent => {
      if (agent.speechText) {
        const x = agent.currentX;
        const y = agent.currentY - 38;

        ctx.font = '9px "JetBrains Mono"';
        const textWidth = ctx.measureText(agent.speechText).width;
        const pad = 6;

        ctx.fillStyle = 'rgba(10, 14, 22, 0.95)';
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(x - (textWidth / 2) - pad, y - 10, textWidth + pad * 2, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(agent.speechText, x, y);
      }
    });
  }
}
