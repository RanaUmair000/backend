const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const FeeInvoice = require('../models/fees/FeeInvoice');

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Cards Data
    const totalStudents = await Student.countDocuments({ status: { $ne: 'Graduated' } }); // Approx active
    const totalTeachers = await Teacher.countDocuments({ status: 'Active' });
    const totalClasses = await Class.countDocuments();
    
    const revenueAgg = await FeeInvoice.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: '$paidAmount' } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

    // 2. ChartOne: Revenue & Expected over last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const monthlyRevenue = await FeeInvoice.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      { 
        $group: { 
          _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } }, 
          totalPaid: { $sum: '$paidAmount' },
          totalExpected: { $sum: '$totalAmount' }
        } 
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format for ChartOne (12 months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const categoriesOne = [];
    const seriesTotalPaid = [];
    const seriesTotalExpected = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(currentMonth - i);
      categoriesOne.push(monthNames[d.getMonth()]);
      
      const match = monthlyRevenue.find(m => m._id.month === d.getMonth() + 1 && m._id.year === d.getFullYear());
      seriesTotalPaid.push(match ? match.totalPaid : 0);
      seriesTotalExpected.push(match ? match.totalExpected : 0);
    }

    const chartOne = {
      categories: categoriesOne,
      series: [
        { name: 'Total Revenue', data: seriesTotalPaid },
        { name: 'Expected Revenue', data: seriesTotalExpected }
      ]
    };

    // 3. ChartTwo: Revenue over the last 4 weeks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const weeklyRevenue = await FeeInvoice.aggregate([
      { $match: { createdAt: { $gte: fourWeeksAgo } } },
      {
        $group: {
          _id: { week: { $isoWeek: "$createdAt" }, year: { $isoWeekYear: "$createdAt" } },
          totalPaid: { $sum: '$paidAmount' }
        }
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } }
    ]);
    
    const chartTwoData = weeklyRevenue.map(w => w.totalPaid);
    while (chartTwoData.length < 4) {
      chartTwoData.unshift(0);
    }
    
    const chartTwo = {
      categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4'].slice(0, chartTwoData.length),
      series: [
        { name: 'Revenue', data: chartTwoData.slice(-4) }
      ]
    };

    // 4. ChartThree: New admissions last 30 days grouped by Class
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // In Patient model, createdAt is stored as String natively, but aggregate with strings works contextually for ISO
    const admissionsAgg = await Student.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo.toISOString() } } },
      {
        $addFields: {
           classObjId: { $toObjectId: "$class" }
        }
      },
      { $group: { _id: '$classObjId', count: { $sum: 1 } } },
      { $lookup: { from: 'classes', localField: '_id', foreignField: '_id', as: 'classObj' } }
    ]);
    
    const chartThreeSeries = [];
    const chartThreeLabels = [];
    
    admissionsAgg.forEach(item => {
      chartThreeSeries.push(item.count);
      const cName = item.classObj && item.classObj.length > 0 ? `${item.classObj[0].name} (${item.classObj[0].section})` : 'Unknown';
      chartThreeLabels.push(cName);
    });
    
    const chartThree = {
      series: chartThreeSeries.length ? chartThreeSeries : [0],
      labels: chartThreeLabels.length ? chartThreeLabels : ['No Admissions']
    };

    // MapOne Data: Enrollment counts by City
    const mapAgg = await Student.aggregate([
      { $group: { _id: '$address.city', count: { $sum: 1 } } }
    ]);
    const mapData = mapAgg
      .filter(x => x._id && x._id.trim() !== "")
      .map(x => ({ city: x._id, count: x.count }));

    // 5. TableOne: Recent Enrollments
    const recentStudents = await Student.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('class', 'name section'); // using name and section
    
    const tableOne = recentStudents;

    // 6. ChatCard: Active Teachers List
    const activeTeachers = await Teacher.find({ status: 'Active' })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('firstName lastName subject profilePic');

    res.status(200).json({
      success: true,
      data: {
        cards: {
          totalStudents,
          totalTeachers,
          totalClasses,
          totalRevenue
        },
        chartOne,
        chartTwo,
        chartThree,
        mapData,
        tableOne,
        teachers: activeTeachers
      }
    });

  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching dashboard stats' });
  }
};
