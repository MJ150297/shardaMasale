#!/usr/bin/env node

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

import User from '@/models/User';
import Settings from '@/models/Settings';
import { hashPassword } from '@/lib/utils';

dotenv.config({ path: '.env.local' });

async function seedOwner() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not configured in environment variables');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    const existingUsers = await User.countDocuments();
    
    if (existingUsers > 0) {
      console.log('ℹ️  Users already exist. Skipping seed.');
      process.exit(0);
    }

    const passwordHash = await hashPassword('Admin@123');

    const owner = await User.create({
      name: 'System Owner',
      email: 'owner@business.com',
      passwordHash,
      role: 'owner',
      status: 'active',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    });

    console.log(`✅ Created owner user: ${owner.email}`);
    console.log('ℹ️  Default password: Admin@123');

    await Settings.create({
      owner: owner._id,
      business: {
        legalName: 'My Business',
        displayName: 'My Business',
        address: {
          line1: '123 Business Street',
          city: 'City',
          state: 'State',
          postalCode: '123456',
          country: 'India',
        },
      },
    });

    console.log('✅ Created default settings');
    console.log('');
    console.log('✅ Bootstrap complete! You can now login.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seed:', error);
    process.exit(1);
  }
}

seedOwner();