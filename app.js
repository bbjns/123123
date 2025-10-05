// v6.7 - base v6.6 code, added '加仓保证金' and removed style tag in add title
function F(n){ return new Decimal(n||0); }
function fmt(n,d=6){
  const s = F(n).toFixed(d);
  const parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}
function makeRow(label, value){ return `<div class="row"><div class="label">${label}</div><div class="value">${value}</div></div>`; }

function calculate(){
  const balance = F(document.getElementById('balance').value || 0);
  const leverage = F(document.getElementById('leverage').value || 1);
  const riskPercentRaw = F(document.getElementById('riskPercent').value || 0);
  const riskPercent = riskPercentRaw.div(100);
  const direction = document.getElementById('direction').value;
  const entry = F(document.getElementById('entryPrice').value || 0);
  const stopLossInput = document.getElementById('stopLoss').value;
  const takeProfitInput = document.getElementById('takeProfit').value;
  const rrInput = document.getElementById('rrRatio').value;
  const feeRateRaw = F(document.getElementById('feeRate').value || 0);
  const feeRate = feeRateRaw.div(100);
  const rounds = parseInt(document.getElementById('compoundRounds').value || '0', 10);
  const addCond = F(document.getElementById('addCondition').value || 0).div(100);
  const addPercent = F(document.getElementById('addPercent').value || 0).div(100);

  const results = document.getElementById('results');
  results.innerHTML = '';

  if (balance.lte(0) || entry.lte(0) || leverage.lte(0) || riskPercent.lte(0)){
    results.innerHTML = `<div class="card"><div class="label">请填写有效的：账户总资金 / 开仓价 / 杠杆 / 风险占比。</div></div>`;
    return;
  }

  // base calculations
  const riskFunds = balance.mul(riskPercent);
  const posNotional = riskFunds.mul(leverage);
  const contracts = posNotional.div(entry);
  const marginUsed = posNotional.div(leverage);
  const fee = posNotional.mul(feeRate).mul(2);
  let stopPrice = F(0), takePrice = F(0), mode = 'none';

  if (stopLossInput && takeProfitInput){
    stopPrice = F(stopLossInput);
    takePrice = F(takeProfitInput);
    mode = 'price';
  } else if (rrInput){
    const rr = F(rrInput);
    const lossPerUnit = riskFunds.div(contracts);
    stopPrice = direction==='long' ? entry.sub(lossPerUnit) : entry.add(lossPerUnit);
    takePrice = direction==='long' ? entry.add(lossPerUnit.mul(rr)) : entry.sub(lossPerUnit.mul(rr));
    mode = 'R';
  }

  const lossPerUnit = direction==='long' ? entry.sub(stopPrice) : stopPrice.sub(entry);
  const profitPerUnit = direction==='long' ? takePrice.sub(entry) : entry.sub(takePrice);
  const grossLoss = lossPerUnit.mul(contracts);
  const grossProfit = profitPerUnit.mul(contracts);
  const netLoss = grossLoss.add(fee);
  const netProfit = grossProfit.sub(fee);

  // base card
  const baseCard = document.createElement('div');
  baseCard.className = 'card';
  baseCard.innerHTML = `<h2>📊 基础计算</h2>` +
    makeRow('账户总资金', fmt(balance) + ' U') +
    makeRow('风险资金 (总资金%)', fmt(riskFunds) + ' U') +
    makeRow('占用保证金', fmt(marginUsed) + ' U') +
    makeRow('名义仓位', fmt(posNotional) + ' U') +
    makeRow('合约数量', fmt(contracts)) +
    makeRow('方向', direction==='long' ? '做多' : '做空') +
    makeRow('开仓价', fmt(entry)) +
    makeRow('止损价', stopPrice.gt(0) ? fmt(stopPrice) : '未设置') +
    makeRow('止盈价', takePrice.gt(0) ? fmt(takePrice) : '未设置') +
    makeRow('手续费 (名义双向)', fmt(fee) + ' U') +
    makeRow('毛亏损', fmt(grossLoss) + ' U') +
    makeRow('毛盈利', fmt(grossProfit) + ' U') +
    makeRow('净亏损', fmt(netLoss) + ' U') +
    makeRow('净盈利', fmt(netProfit) + ' U');
  results.appendChild(baseCard);

  // separator
  const sep1 = document.createElement('div'); sep1.className='sep'; results.appendChild(sep1);

  // add-on v6 style - always simulate add when addPercent provided
  if (addPercent.gt(0)){
    const addCard = document.createElement('div'); addCard.className='card';
    // title without v6 note
    addCard.innerHTML = `<h2>📈 浮盈加仓</h2>`;
    const addPrice = addCond.gt(0) ? (direction==='long' ? entry.mul(F(1).add(addCond)) : entry.mul(F(1).sub(addCond))) : entry;
    const addNotional = posNotional.mul(addPercent);
    const addContracts = addNotional.div(addPrice);
    const totalNotional = posNotional.add(addNotional);
    const totalContracts = contracts.add(addContracts);
    const avgEntry = contracts.mul(entry).add(addContracts.mul(addPrice)).div(totalContracts);
    const newMargin = totalNotional.div(leverage);
    const addMargin = addNotional.div(leverage); // 加仓保证金
    const newFee = totalNotional.mul(feeRate).mul(2);

    let newStop = stopPrice, newTP = takePrice;
    if (mode==='R' && rrInput){
      const rr = F(rrInput);
      const origLossPct = lossPerUnit.div(entry);
      newStop = direction==='long' ? avgEntry.mul(F(1).sub(origLossPct)) : avgEntry.mul(F(1).add(origLossPct));
      newTP = direction==='long' ? avgEntry.mul(F(1).add(origLossPct.mul(rr))) : avgEntry.mul(F(1).sub(origLossPct.mul(rr)));
    }

    const newLossPerUnit = direction==='long' ? avgEntry.sub(newStop) : newStop.sub(avgEntry);
    const newProfitPerUnit = direction==='long' ? newTP.sub(avgEntry) : avgEntry.sub(newTP);
    const newGrossLoss = newLossPerUnit.mul(totalContracts);
    const newGrossProfit = newProfitPerUnit.mul(totalContracts);
    const newNetLoss = newGrossLoss.add(newFee);
    const newNetProfit = newGrossProfit.sub(newFee);

    addCard.innerHTML += makeRow('加仓比例', fmt(addPercent.times(100)) + ' %');
    addCard.innerHTML += makeRow('加仓触发价（若设置偏移）', fmt(addPrice));
    addCard.innerHTML += makeRow('初始合约数量', fmt(contracts));
    addCard.innerHTML += makeRow('加仓合约数量', fmt(addContracts));
    addCard.innerHTML += makeRow('总合约数量', fmt(totalContracts));
    addCard.innerHTML += makeRow('加仓后平均开仓价', fmt(avgEntry));
    addCard.innerHTML += makeRow('加仓名义仓位', fmt(addNotional) + ' U');
    addCard.innerHTML += makeRow('加仓保证金', fmt(addMargin) + ' U');
    addCard.innerHTML += makeRow('加仓后名义仓位 (总)', fmt(totalNotional) + ' U');
    addCard.innerHTML += makeRow('加仓后占用保证金 (总)', fmt(newMargin) + ' U');
    addCard.innerHTML += makeRow('加仓后手续费', fmt(newFee) + ' U');
    addCard.innerHTML += makeRow('加仓后毛亏损', fmt(newGrossLoss) + ' U');
    addCard.innerHTML += makeRow('加仓后毛盈利', fmt(newGrossProfit) + ' U');
    addCard.innerHTML += makeRow('加仓后净亏损', fmt(newNetLoss) + ' U');
    addCard.innerHTML += makeRow('加仓后净盈利', fmt(newNetProfit) + ' U');

    results.appendChild(addCard);
    const sep2 = document.createElement('div'); sep2.className='sep'; results.appendChild(sep2);
  }

  // compound section
  if (rounds > 0){
    const compCard = document.createElement('div'); compCard.className='card';
    compCard.innerHTML = `<h2>🔄 复利计算（每轮止损/止盈/净利/余额）</h2>`;
    const listDiv = document.createElement('div'); listDiv.className='compound-list';
    compCard.appendChild(listDiv);

    let bal = balance;
    for (let i=1;i<=rounds;i++){
      const riskFundsR = bal.mul(riskPercent);
      const posNotionalR = riskFundsR.mul(leverage);
      const contractsR = posNotionalR.div(entry);
      let slR = stopPrice, tpR = takePrice;
      if (mode==='R' && rrInput){
        const rr = F(rrInput);
        const lossPerUnitR = riskFundsR.div(contractsR);
        slR = direction==='long' ? entry.sub(lossPerUnitR) : entry.add(lossPerUnitR);
        tpR = direction==='long' ? entry.add(lossPerUnitR.mul(rr)) : entry.sub(lossPerUnitR.mul(rr));
      }
      const lossPerUnitR = direction==='long' ? entry.sub(slR) : slR.sub(entry);
      const profitPerUnitR = direction==='long' ? tpR.sub(entry) : entry.sub(tpR);
      const grossProfitR = profitPerUnitR.mul(contractsR);
      const feeR = posNotionalR.mul(feeRate).mul(2);
      const netProfitR = grossProfitR.sub(feeR);
      bal = bal.add(netProfitR);

      const rowHtml = `<div class="row"><div class="label">第${i}轮</div><div class="value">止损:${fmt(slR)} / 止盈:${fmt(tpR)}<br>当轮净利:${fmt(netProfitR)} U<br>余额:${fmt(bal)} U</div></div>`;
      listDiv.innerHTML += rowHtml;
    }

    compCard.appendChild(listDiv);
    results.appendChild(compCard);
    setTimeout(()=>{ const el = results.querySelector('.compound-list'); if(el) el.scrollTop = el.scrollHeight; }, 10);
  }

  results.scrollTop = 0;
}

function resetForm(){
  document.querySelectorAll('input').forEach(i=>i.value='');
  document.getElementById('results').innerHTML='';
}

function exportTXT(){
  const results = document.getElementById('results').innerText;
  if(!results){ alert('无结果可导出'); return; }
  const blob = new Blob([results], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'futures_v6.7_result.txt'; a.click();
}
