// Today
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const todayTotal = orders.filter(o => {
  if (!o.createdAt?.toDate) return false;
  const d = o.createdAt.toDate();
  return d >= todayStart;
}).reduce((s, o) => s + (o.total || 0), 0);

// This Week
const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
weekStart.setHours(0, 0, 0, 0);
const effectiveWeekStart = weekStart < REPORT_START ? REPORT_START : weekStart;
const weekTotal = orders.filter(o => {
  if (!o.createdAt?.toDate) return false;
  return o.createdAt.toDate() >= effectiveWeekStart;
}).reduce((s, o) => s + (o.total || 0), 0);

// This Month
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const effectiveMonthStart = monthStart < REPORT_START ? REPORT_START : monthStart;
const monthTotal = orders.filter(o => {
  if (!o.createdAt?.toDate) return false;
  return o.createdAt.toDate() >= effectiveMonthStart;
}).reduce((s, o) => s + (o.total || 0), 0);

// Total Orders — already filtered at load time, so just use orders.length
