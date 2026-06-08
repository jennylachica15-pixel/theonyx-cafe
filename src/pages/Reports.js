{activeTab === 'daily' && (
  <div style={s.card}>
    <div style={s.cardTitle}>Daily Sales - Last 7 Days</div>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, marginBottom: 4 }}>
      {dailyData.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 9, color: 'var(--brown-mid)', marginBottom: 2, textAlign: 'center' }}>
            {!d.disabled && d.total > 0 ? (d.total >= 1000 ? `${(d.total/1000).toFixed(1)}k` : d.total) : ''}
          </div>
          <div style={{
            width: '80%',
            height: `${d.disabled ? 0 : Math.max((d.total / maxDaily) * 100, d.total > 0 ? 4 : 0)}%`,
            background: d.disabled ? '#e8e8e8' : 'var(--brown-dark)',
            borderRadius: '4px 4px 0 0',
            transition: 'height 0.4s ease',
          }} />
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 4 }}>
      {dailyData.map((d, i) => (
        <div key={i} style={{ flex: 1, fontSize: 9, color: d.disabled ? '#ccc' : 'var(--brown-light)', textAlign: 'center' }}>{d.label}</div>
      ))}
    </div>
  </div>
)}
