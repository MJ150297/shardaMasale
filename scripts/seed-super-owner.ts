#!/usr/bin/env node

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

import User from '@/models/User';
import { hashPassword } from '@/lib/utils';

dotenv.config({ path: '.env.local' });

async function seedSuperOwner() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not configured in environment variables');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    const existingSuperOwner = await User.findOne({ role: 'superOwner' });
    
    if (existingSuperOwner) {
      console.log('ℹ️  Super Owner already exists.');
      console.log(`ℹ️  Email: ${existingSuperOwner.email}`);
      process.exit(0);
    }

    const passwordHash = await hashPassword('Super@12345');

    const superOwner = await User.create({
      name: 'Super Owner',
      email: 'super@gsms.local',
      passwordHash,
      role: 'superOwner',
      status: 'active',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      subscription: {
        plan: 'unlimited',
        status: 'active',
      },
    });

    console.log('');
    console.log('✅ ✅ SUPER OWNER CREATED SUCCESSFULLY ✅ ✅');
    console.log('');
    console.log(`📧 Email:    ${superOwner.email}`);
    console.log(`🔑 Password: Super@12345`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password immediately after first login');
    console.log('');
    console.log('✅ You can now login as Super Owner and create Shop Owners');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seed:', error);
    process.exit(1);
  }
}

seedSuperOwner();