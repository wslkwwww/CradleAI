/**
 * This script tests the RabbitMQ connection with the credentials from .env file
 * Run with: node scripts/test-rabbitmq-connection.js
 */

// Load environment variables
require('dotenv').config();
const amqp = require('amqplib');

const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost';

async function testConnection() {
  console.log('Testing RabbitMQ connection...');
  
  try {
    // Try to connect with credentials
    console.log(`Connecting to ${maskUrl(rabbitmqUrl)}`);
    const connection = await amqp.connect(rabbitmqUrl);
    
    console.log('✅ Successfully connected to RabbitMQ');
    
    // Create a channel
    const channel = await connection.createChannel();
    console.log('✅ Successfully created a channel');
    
    // Test queue assertion
    const testQueue = 'test_connection_queue';
    await channel.assertQueue(testQueue, { durable: false });
    console.log(`✅ Successfully asserted queue: ${testQueue}`);
    
    // Clean up test queue
    await channel.deleteQueue(testQueue);
    console.log(`✅ Successfully cleaned up test queue`);
    
    // Close connection
    await channel.close();
    await connection.close();
    console.log('✅ Connection closed properly');
    
    console.log('\n🎉 All tests passed! RabbitMQ connection is working correctly.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:');
    
    if (error.message.includes('ACCESS_REFUSED')) {
      console.error('  Authentication failed. Please check your username and password.');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('  Connection refused. Please check if RabbitMQ server is running.');
    } else {
      console.error(`  Error: ${error.message}`);
    }
    
    console.error('\n📝 Troubleshooting steps:');
    console.error('1. Make sure RabbitMQ server is running');
    console.error('2. Check the credentials in .env file');
    console.error('3. Verify that the RabbitMQ user has appropriate permissions');
    console.error('4. Ensure the virtual host exists and is accessible');
    
    process.exit(1);
  }
}

// Mask sensitive parts of the URL for logging
function maskUrl(url) {
  try {
    return url.replace(/(amqp:\/\/[^:]+:)([^@]+)(@.+)/, '$1*****$3');
  } catch (e) {
    return 'Invalid URL format';
  }
}

// Run the test
testConnection();
