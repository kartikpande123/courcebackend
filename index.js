const express = require("express");
const app = express();
const port = 2002;
const admin = require("./db/firebaseConfig").firebaseAdmin;
const cors = require("cors");
const multer = require('multer');
const path = require('path');

// Multer setup for image upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit: 5 MB
});

// Middleware
app.use(cors({
  origin: '*', // Allows all domains (use cautiously)
  credentials: true,
}));




// Firestore setup
const firestore = admin.firestore();
const realtimeDatabase = admin.database();

// Reference to categories in realtime database
const categoriesRef = realtimeDatabase.ref('categories');

// Root route
app.get("/", (req, res) => {
  res.send("Node.js backend is running successfully!");
});


// category apis
// Create category
app.post("/api/categories", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const newCategoryRef = categoriesRef.push();
    await newCategoryRef.set({
      name,
      createdAt: admin.database.ServerValue.TIMESTAMP
    });

    res.status(201).json({
      id: newCategoryRef.key,
      name
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// Get all categories
app.get("/api/categories", async (req, res) => {
  try {
    const snapshot = await categoriesRef.once('value');
    const categories = [];
    
    snapshot.forEach((childSnapshot) => {
      categories.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Update category
app.put("/api/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const categoryRef = categoriesRef.child(id);
    await categoryRef.update({
      name,
      updatedAt: admin.database.ServerValue.TIMESTAMP
    });

    res.json({ id, name });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// Delete category
app.delete("/api/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await categoriesRef.child(id).remove();
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});


//Add cource apis
// Modified course POST API
app.post("/api/courses", async (req, res) => {
  try {
    // Validate the base64 image size
    const base64String = req.body.courseImage;
    if (base64String) {
      // Remove data:image/jpeg;base64, prefix
      const base64Data = base64String.split(',')[1];
      const sizeInBytes = Buffer.from(base64Data, 'base64').length;
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      if (sizeInMB > 2) { // Set maximum size to 2MB
        return res.status(400).json({ 
          error: 'Image size too large. Please use an image less than 2MB.' 
        });
      }
    }

    const courseData = {
      title: req.body.title,
      categoryId: req.body.categoryId,
      imageBase64: req.body.courseImage,
      startDate: req.body.startDate,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      pdfLink: req.body.pdfLink,
      fees: Number(req.body.fees),
      details: req.body.details,
      lastDateToApply: req.body.lastDateToApply,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await firestore.collection('courses').add(courseData);
    res.status(201).json({ id: docRef.id, ...courseData });
  } catch (error) {
    console.error('Error adding course:', error);
    res.status(500).json({ error: error.message || 'Failed to add course' });
  }
});

// Modified course GET API
app.get("/api/courses", async (req, res) => {
  try {
    const coursesSnapshot = await firestore.collection('courses').get();
    const courses = [];
    
    coursesSnapshot.forEach(doc => {
      courses.push({ 
        id: doc.id, 
        ...doc.data()
      });
    });
    
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Modified course PUT API
app.put("/api/courses/:id", async (req, res) => {
  try {
    const courseData = {
      title: req.body.title,
      categoryId: req.body.categoryId,
      startDate: req.body.startDate,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      pdfLink: req.body.pdfLink,
      fees: Number(req.body.fees),
      details: req.body.details,
      lastDateToApply: req.body.lastDateToApply,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Only update image if new one is provided
    if (req.body.courseImage) {
      courseData.imageBase64 = req.body.courseImage;
    }

    await firestore.collection('courses').doc(req.params.id).update(courseData);
    res.json({ id: req.params.id, ...courseData });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

app.delete("/api/courses/:id", async (req, res) => {
  try {
    await firestore.collection('courses').doc(req.params.id).delete();
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// In your Express backend
app.get("/api/courses/:id", async (req, res) => {
  try {
    const courseDoc = await firestore.collection('courses').doc(req.params.id).get();
    
    if (!courseDoc.exists) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const courseData = courseDoc.data();
    
    // Convert the base64 image data to a proper URL format if it exists
    if (courseData.imageBase64) {
      // Check if the base64 string already includes the data URL prefix
      if (!courseData.imageBase64.startsWith('data:')) {
        courseData.imageUrl = `data:image/jpeg;base64,${courseData.imageBase64}`;
      } else {
        courseData.imageUrl = courseData.imageBase64;
      }
      delete courseData.imageBase64; // Remove the raw base64 data
    }

    res.json({
      id: courseDoc.id,
      ...courseData
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
});

// Admin Notification Apis 
app.get('/api/notifications', async (req, res) => {
  try {
    const notificationsRef = realtimeDatabase.ref('notifications');
    const snapshot = await notificationsRef.once('value');
    const notifications = snapshot.val();
    
    if (!notifications) {
      return res.json([]);
    }

    const notificationsList = Object.entries(notifications).map(([id, data]) => ({
      id,
      ...data
    }));

    res.json(notificationsList);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Create new notification
app.post('/api/notifications', async (req, res) => {
  try {
    const { message } = req.body;
    const timestamp = new Date().toISOString();
    
    const newNotification = {
      message,
      timestamp,
    };

    const notificationsRef = realtimeDatabase.ref('notifications');
    const newRef = await notificationsRef.push(newNotification);
    
    res.status(201).json({
      id: newRef.key,
      ...newNotification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Update notification
app.put('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const timestamp = new Date().toISOString();

    const notificationRef = realtimeDatabase.ref(`notifications/${id}`);
    await notificationRef.update({
      message,
      timestamp
    });

    res.json({ message: 'Notification updated successfully' });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Delete notification
app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const notificationRef = realtimeDatabase.ref(`notifications/${id}`);
    await notificationRef.remove();
    
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});


//Help Apis
app.get('/api/help-requests', async (req, res) => {
  try {
    // Get all documents from the helpRequests collection
    const helpRequestsSnapshot = await firestore.collection('helpRequests')
      .orderBy('timestamp', 'desc') // Optional: Sort by timestamp in descending order
      .get();

    const helpRequests = [];

    // Iterate through each document
    helpRequestsSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Add document to array with all fields including the base64 image
      helpRequests.push({
        id: doc.id,
        applicationId: data.applicationId,
        name: data.name,
        phoneNumber: data.phoneNumber,
        concern: data.concern,
        image: data.image, // Base64 image from Firestore
        status: data.status,
        timestamp: data.timestamp ? data.timestamp.toDate() : null
      });
    });

    // Set appropriate headers for large responses
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    // Send the response
    res.json(helpRequests);
  } catch (error) {
    console.error('Error fetching help requests:', error);
    res.status(500).json({ 
      error: 'Failed to fetch help requests',
      details: error.message 
    });
  }
});


app.delete('/api/help-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if document exists
    const docRef = firestore.collection('helpRequests').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Concern not found' });
    }

    // Delete the document
    await docRef.delete();

    res.json({ message: 'Concern deleted successfully', id });
  } catch (error) {
    console.error('Error deleting concern:', error);
    res.status(500).json({ 
      error: 'Failed to delete concern',
      details: error.message 
    });
  }
});

// Create new help request
app.post('/api/help-requests', async (req, res) => {
  try {
    // Validate the base64 image size
    const base64String = req.body.imageBase64;
    if (base64String) {
      // Remove data:image/<type>;base64, prefix if present
      const base64Data = base64String.includes('base64,') 
        ? base64String.split('base64,')[1] 
        : base64String;
      
      const sizeInBytes = Buffer.from(base64Data, 'base64').length;
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      if (sizeInMB > 5) {
        return res.status(400).json({
          error: 'Image size too large. Please use an image less than 5MB.'
        });
      }
    }

    const helpData = {
      applicationId: req.body.applicationId,
      name: req.body.name,
      phoneNumber: req.body.phoneNumber,
      concern: req.body.concern,
      image: base64String, // Validated base64 image string
      status: 'pending',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await firestore.collection('helpRequests').add(helpData);
    res.status(201).json({ id: docRef.id, ...helpData });
  } catch (error) {
    console.error('Error creating help request:', error);
    res.status(500).json({ error: 'Failed to create help request' });
  }
});


//Application forms
// Applications reference in realtime database
const applicationsRef = realtimeDatabase.ref('applications');

//Application apis
app.post('/api/applications', async (req, res) => {
  try {
    const applicationData = req.body;
    
    // Validate required fields
    const requiredFields = ['applicationId', 'name', 'phone', 'address', 'city', 'state', 'pincode', 'dob'];
    const missingFields = requiredFields.filter(field => !applicationData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate phone number format
    if (!/^\d{10}$/.test(applicationData.phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Validate pincode format
    if (!/^\d{6}$/.test(applicationData.pincode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pincode format'
      });
    }

    // Add timestamp
    applicationData.createdAt = admin.database.ServerValue.TIMESTAMP;

    // Store in Firebase
    await applicationsRef.child(applicationData.applicationId).set(applicationData);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: applicationData.applicationId
      }
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET endpoint to fetch all applications
app.get('/api/applications', async (req, res) => {
  try {
    const snapshot = await applicationsRef.once('value');
    const applications = snapshot.val();

    res.status(200).json({
      success: true,
      data: applications || {}
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.get('/api/applications/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const snapshot = await applicationsRef.child(applicationId).once('value');
    const application = snapshot.val();

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.put('/api/applications/:applicationId/status', async (req, res) => {
  const { applicationId } = req.params;
  const { status } = req.body;

  if (!['SELECTED', 'REJECTED', 'PENDING'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value. Must be SELECTED, REJECTED, or PENDING.',
    });
  }

  try {
    const snapshot = await applicationsRef.once('value');
    const applications = snapshot.val();

    if (!applications || !applications[applicationId]) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    // Update the status of the application
    await applicationsRef.child(applicationId).update({ status });

    res.status(200).json({
      success: true,
      message: 'Application status updated successfully',
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});


//payment page
app.post('/api/payments', async (req, res) => {
  try {
    const { 
      applicationId, 
      courseName, 
      name, 
      phone, 
      email, 
      feeAmount 
    } = req.body;

    // Reference to the specific path in the database
    const paymentRef = realtimeDatabase.ref(`payments/${courseName}/${applicationId}`);

    // Data to be saved
    const paymentData = {
      name,
      phone,
      email,
      feeAmount: parseFloat(feeAmount),
      updatedAt: admin.database.ServerValue.TIMESTAMP,
      createdAt: admin.database.ServerValue.TIMESTAMP
    };

    // Save data to database
    await paymentRef.set(paymentData);

    res.status(200).json({
      success: true,
      message: 'Payment data saved successfully',
      data: paymentData
    });
  } catch (error) {
    console.error('Error saving payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save payment data',
      error: error.message
    });
  }
});

// PATCH endpoint to update fee amount
app.patch('/api/payments/:courseId/:applicationId', async (req, res) => {
  try {
    const { courseId, applicationId } = req.params;
    const { feeAmount } = req.body;

    const paymentRef = realtimeDatabase.ref(`payments/${courseId}/${applicationId}`);
    
    // Update only the fee amount and timestamp
    await paymentRef.update({
      feeAmount: parseFloat(feeAmount),
      updatedAt: admin.database.ServerValue.TIMESTAMP
    });

    res.status(200).json({
      success: true,
      message: 'Fee amount updated successfully'
    });
  } catch (error) {
    console.error('Error updating fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fee amount',
      error: error.message
    });
  }
});

// GET endpoint to fetch payment details
app.get('/api/payments/:courseId/:applicationId', async (req, res) => {
  try {
    const { courseId, applicationId } = req.params;

    // Reference to the specific path in the database
    const paymentRef = realtimeDatabase.ref(`payments/${courseId}/${applicationId}`);

    // Fetch payment data
    paymentRef.once('value', (snapshot) => {
      if (snapshot.exists()) {
        res.status(200).json({
          success: true,
          data: snapshot.val(),
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Payment data not found',
        });
      }
    });
  } catch (error) {
    console.error('Error fetching payment data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment data',
      error: error.message,
    });
  }
});


//Gmeet Apis
// Save Google Meet link
// Save Google Meet link with course title
app.post("/api/courses/meet", async (req, res) => {
  try {
    const { courseId, courseTitle, meetLink } = req.body;
    
    if (!courseId || !courseTitle || !meetLink) {
      return res.status(400).json({ 
        error: 'Missing required fields. Please provide courseId, courseTitle, and meetLink' 
      });
    }

    await realtimeDatabase.ref('GoogleMeet').child(courseId).set({
      courseId,
      courseTitle,
      meetLink,
      updatedAt: new Date().toISOString()
    });
    
    res.json({ 
      message: 'Google Meet link and course details saved successfully',
      data: {
        courseId,
        courseTitle,
        meetLink
      }
    });
  } catch (error) {
    console.error('Error saving meet link:', error);
    res.status(500).json({ error: 'Failed to save meet link' });
  }
});


app.get("/api/meetlinks/all", async (req, res) => {
  try {
    // Get reference to the GoogleMeet node
    const meetRef = admin.database().ref('GoogleMeet');
    
    // Add debug logging
    console.log('Attempting to fetch from path: GoogleMeet');
    
    // Fetch all records
    const snapshot = await meetRef.once('value');
    const data = snapshot.val();
    
    // console.log('Fetched data:', data);

    // Check if data exists
    if (!data) {
      return res.status(200).json({
        status: false,
        message: 'No meet links available',
        data: []
      });
    }

    // Convert the data to array format
    const meetLinks = Object.keys(data).map(key => ({
      ...data[key]
    }));

    return res.status(200).json({
      status: true,
      message: 'Meet links retrieved successfully',
      data: meetLinks
    });

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to fetch meet links',
      error: error.message
    });
  }
});

//Admin Logi Api
app.post('/api/admin/login', async (req, res) => {
  try {
    const { userId, password } = req.body;
    
    const snapshot = await realtimeDatabase.ref('AdminLogin').once('value');
    const adminData = snapshot.val();
    
    if (adminData.userid === userId && adminData.password === password) {
      res.status(200).json({ 
        success: true, 
        message: 'Login successful' 
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});





// Start the server/api
app.listen(port, () => {
  console.log(`Port started on ${port}`);
});