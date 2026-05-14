'use client';

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useActiveShop } from "@/components/providers/shop-provider";
import type { ISettings } from "@/models/Settings";

type SettingsFormData = Omit<ISettings, '_id' | 'owner' | 'shopId' | 'createdAt' | 'updatedAt' | '__v'>;

export default function SettingsPage() {
  const { activeShopId, currentShop } = useActiveShop();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("business");

  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<SettingsFormData>({
    defaultValues: {
      business: {
        legalName: "",
        displayName: "",
        email: "",
        phoneNumber: "",
        gstin: "",
        pan: "",
        address: {
          line1: "",
          line2: "",
          city: "",
          state: "",
          postalCode: "",
          country: "India",
        },
      },
      localization: {
        currency: "INR",
        timezone: "Asia/Kolkata",
        language: "en",
        dateFormat: "dd/MM/yyyy",
      },
      inventory: {
        lowStockThreshold: 5,
        allowNegativeStock: false,
        trackBatches: false,
        trackExpiry: false,
        defaultUnit: "pcs",
      },
      taxation: {
        pricesIncludeTax: false,
        defaultTaxRate: 0,
        taxLabel: "GST",
      },
      billing: {
        invoicePrefix: "INV",
        purchasePrefix: "PUR",
        paymentPrefix: "PAY",
        quotationPrefix: "QTN",
        nextInvoiceSequence: 1,
        nextPurchaseSequence: 1,
        nextPaymentSequence: 1,
        autoRoundOff: true,
        termsAndConditions: "",
      },
      security: {
        sessionTimeoutMinutes: 480,
        maxLoginAttempts: 5,
        passwordMinLength: 8,
        requireTwoFactor: false,
      },
      notifications: {
        emailEnabled: false,
        lowStockAlerts: true,
        duePaymentAlerts: true,
        dailySummary: false,
      },
      pos: {
        defaultWalkInCustomerName: "Walk-in Customer",
        enableBarcodeScanner: true,
        printAfterSale: false,
      },
      enabledModules: ["inventory", "billing", "crm", "reports"],
      featureFlags: {},
      metadata: {},
    }
  });

  useEffect(() => {
    if (activeShopId) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [activeShopId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/settings?shopId=${activeShopId}`);
      if (!response.ok) throw new Error("Failed to fetch settings");

      const settings = await response.json();
      reset(settings);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/settings?shopId=${activeShopId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!activeShopId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure your shop settings
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Please select a shop to manage settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-100 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            {currentShop ? `Configure settings for ${currentShop.name}` : 'Configure business and system settings'}
          </p>
        </div>
        <Button onClick={handleSubmit(onSubmit)} disabled={saving}>
          <Save className="size-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-9 w-full">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="localization">Localization</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="tax">Tax</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="pos">POS</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          {/* Business Information Tab */}
          <TabsContent value="business" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Business Profile</CardTitle>
                <CardDescription>
                  Your business legal information and contact details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="business.legalName">Legal Business Name</Label>
                    <Input id="business.legalName" {...register("business.legalName")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business.displayName">Display Name</Label>
                    <Input id="business.displayName" {...register("business.displayName")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="business.email">Business Email</Label>
                    <Input id="business.email" type="email" {...register("business.email")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business.phoneNumber">Phone Number</Label>
                    <Input id="business.phoneNumber" {...register("business.phoneNumber")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="business.gstin">GSTIN</Label>
                    <Input id="business.gstin" {...register("business.gstin")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business.pan">PAN Number</Label>
                    <Input id="business.pan" {...register("business.pan")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Business Address</Label>
                  <div className="space-y-3">
                    <Input placeholder="Address Line 1" {...register("business.address.line1")} />
                    <Input placeholder="Address Line 2" {...register("business.address.line2")} />
                    <div className="grid grid-cols-3 gap-4">
                      <Input placeholder="City" {...register("business.address.city")} />
                      <Input placeholder="State" {...register("business.address.state")} />
                      <Input placeholder="Postal Code" {...register("business.address.postalCode")} />
                    </div>
                    <Input placeholder="Country" {...register("business.address.country")} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Localization Tab */}
          <TabsContent value="localization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Localization Settings</CardTitle>
                <CardDescription>
                  Currency, timezone and formatting preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="localization.currency">Currency</Label>
                    <Select
                      defaultValue={watch("localization.currency")}
                      onValueChange={(value) => setValue("localization.currency", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                        <SelectItem value="USD">US Dollar ($)</SelectItem>
                        <SelectItem value="EUR">Euro (€)</SelectItem>
                        <SelectItem value="GBP">British Pound (£)</SelectItem>
                        <SelectItem value="AED">UAE Dirham (د.إ)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="localization.timezone">Timezone</Label>
                    <Select
                      defaultValue={watch("localization.timezone")}
                      onValueChange={(value) => setValue("localization.timezone", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="Europe/London">London (GMT)</SelectItem>
                        <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="localization.language">Language</Label>
                    <Select
                      defaultValue={watch("localization.language")}
                      onValueChange={(value) => setValue("localization.language", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="hi">Hindi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="localization.dateFormat">Date Format</Label>
                    <Select
                      defaultValue={watch("localization.dateFormat")}
                      onValueChange={(value) => setValue("localization.dateFormat", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select date format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                        <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Settings</CardTitle>
                <CardDescription>
                  Default inventory behaviour and thresholds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inventory.lowStockThreshold">Low Stock Alert Threshold</Label>
                    <Input
                      id="inventory.lowStockThreshold"
                      type="number"
                      {...register("inventory.lowStockThreshold", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inventory.defaultUnit">Default Unit of Measure</Label>
                    <Input
                      id="inventory.defaultUnit"
                      {...register("inventory.defaultUnit")}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="inventory.allowNegativeStock"
                      checked={watch("inventory.allowNegativeStock")}
                      onCheckedChange={(checked) => setValue("inventory.allowNegativeStock", checked as boolean)}
                    />
                    <Label htmlFor="inventory.allowNegativeStock">Allow Negative Stock</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="inventory.trackBatches"
                      checked={watch("inventory.trackBatches")}
                      onCheckedChange={(checked) => setValue("inventory.trackBatches", checked as boolean)}
                    />
                    <Label htmlFor="inventory.trackBatches">Enable Batch Tracking</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="inventory.trackExpiry"
                      checked={watch("inventory.trackExpiry")}
                      onCheckedChange={(checked) => setValue("inventory.trackExpiry", checked as boolean)}
                    />
                    <Label htmlFor="inventory.trackExpiry">Track Product Expiry Dates</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tax Tab */}
          <TabsContent value="tax" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tax Settings</CardTitle>
                <CardDescription>
                  Tax rates and calculation preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxation.defaultTaxRate">Default Tax Rate (%)</Label>
                    <Input
                      id="taxation.defaultTaxRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      {...register("taxation.defaultTaxRate", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxation.taxLabel">Tax Label</Label>
                    <Input
                      id="taxation.taxLabel"
                      {...register("taxation.taxLabel")}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="taxation.pricesIncludeTax"
                    checked={watch("taxation.pricesIncludeTax")}
                    onCheckedChange={(checked) => setValue("taxation.pricesIncludeTax", checked as boolean)}
                  />
                  <Label htmlFor="taxation.pricesIncludeTax">Product prices already include tax</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Billing Settings</CardTitle>
                <CardDescription>
                  Invoice numbering and billing preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing.invoicePrefix">Invoice Prefix</Label>
                    <Input id="billing.invoicePrefix" {...register("billing.invoicePrefix")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing.purchasePrefix">Purchase Prefix</Label>
                    <Input id="billing.purchasePrefix" {...register("billing.purchasePrefix")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing.paymentPrefix">Payment Prefix</Label>
                    <Input id="billing.paymentPrefix" {...register("billing.paymentPrefix")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing.quotationPrefix">Quotation Prefix</Label>
                    <Input id="billing.quotationPrefix" {...register("billing.quotationPrefix")} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing.nextInvoiceSequence">Next Invoice Number</Label>
                    <Input
                      id="billing.nextInvoiceSequence"
                      type="number"
                      {...register("billing.nextInvoiceSequence", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing.nextPurchaseSequence">Next Purchase Number</Label>
                    <Input
                      id="billing.nextPurchaseSequence"
                      type="number"
                      {...register("billing.nextPurchaseSequence", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing.nextPaymentSequence">Next Payment Number</Label>
                    <Input
                      id="billing.nextPaymentSequence"
                      type="number"
                      {...register("billing.nextPaymentSequence", { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="billing.autoRoundOff"
                      checked={watch("billing.autoRoundOff")}
                      onCheckedChange={(checked) => setValue("billing.autoRoundOff", checked as boolean)}
                    />
                    <Label htmlFor="billing.autoRoundOff">Automatically round off invoice totals</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing.termsAndConditions">Default Terms & Conditions</Label>
                    <Textarea
                      id="billing.termsAndConditions"
                      rows={4}
                      {...register("billing.termsAndConditions")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Session timeout, password policies and authentication preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="security.sessionTimeoutMinutes">Session Timeout (minutes)</Label>
                    <Input
                      id="security.sessionTimeoutMinutes"
                      type="number"
                      min={15}
                      {...register("security.sessionTimeoutMinutes", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security.maxLoginAttempts">Max Login Attempts</Label>
                    <Input
                      id="security.maxLoginAttempts"
                      type="number"
                      min={3}
                      {...register("security.maxLoginAttempts", { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="security.passwordMinLength">Minimum Password Length</Label>
                    <Input
                      id="security.passwordMinLength"
                      type="number"
                      min={8}
                      {...register("security.passwordMinLength", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security.requireTwoFactor">Two-Factor Authentication</Label>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="security.requireTwoFactor"
                        checked={watch("security.requireTwoFactor")}
                        onCheckedChange={(checked) => setValue("security.requireTwoFactor", checked as boolean)}
                      />
                      <Label htmlFor="security.requireTwoFactor">Require 2FA for all users</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Configure email and alert notification settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notifications.emailEnabled"
                      checked={watch("notifications.emailEnabled")}
                      onCheckedChange={(checked) => setValue("notifications.emailEnabled", checked as boolean)}
                    />
                    <Label htmlFor="notifications.emailEnabled">Enable Email Notifications</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notifications.lowStockAlerts"
                      checked={watch("notifications.lowStockAlerts")}
                      onCheckedChange={(checked) => setValue("notifications.lowStockAlerts", checked as boolean)}
                    />
                    <Label htmlFor="notifications.lowStockAlerts">Low Stock Alerts</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notifications.duePaymentAlerts"
                      checked={watch("notifications.duePaymentAlerts")}
                      onCheckedChange={(checked) => setValue("notifications.duePaymentAlerts", checked as boolean)}
                    />
                    <Label htmlFor="notifications.duePaymentAlerts">Due Payment Alerts</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="notifications.dailySummary"
                      checked={watch("notifications.dailySummary")}
                      onCheckedChange={(checked) => setValue("notifications.dailySummary", checked as boolean)}
                    />
                    <Label htmlFor="notifications.dailySummary">Daily Summary Report</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* POS Tab */}
          <TabsContent value="pos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Point of Sale Settings</CardTitle>
                <CardDescription>
                  Configure POS behaviour and defaults
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pos.defaultWalkInCustomerName">Default Walk-in Customer Name</Label>
                    <Input
                      id="pos.defaultWalkInCustomerName"
                      {...register("pos.defaultWalkInCustomerName")}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pos.enableBarcodeScanner"
                      checked={watch("pos.enableBarcodeScanner")}
                      onCheckedChange={(checked) => setValue("pos.enableBarcodeScanner", checked as boolean)}
                    />
                    <Label htmlFor="pos.enableBarcodeScanner">Enable Barcode Scanner</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pos.printAfterSale"
                      checked={watch("pos.printAfterSale")}
                      onCheckedChange={(checked) => setValue("pos.printAfterSale", checked as boolean)}
                    />
                    <Label htmlFor="pos.printAfterSale">Auto-print Receipt After Sale</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Permissions</CardTitle>
                <CardDescription>
                  Manage staff access and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p>Staff permissions management will be implemented here with role-based access control</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  );
}