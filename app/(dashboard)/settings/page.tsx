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
import ShareMessageTemplatesEditor from "@/components/settings/share-message-templates-editor";
import { DEFAULT_SHARE_MESSAGE_TEMPLATES } from "@/lib/share-messages";

type SettingsFormData = Omit<ISettings, '_id' | 'owner' | 'shopId' | 'createdAt' | 'updatedAt' | '__v'>;

export default function SettingsPage() {
  const { activeShopId, currentShop, availableShops } = useActiveShop();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("business");

  const { register, handleSubmit, reset, setValue, watch } = useForm<SettingsFormData>({
    defaultValues: {
      business: {
        legalName: "",
        displayName: "",
        email: "",
        phoneNumber: "",
        website: "",
        gstin: "",
        pan: "",
        address: {
          line1: "",
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
        salePrefix: "SALE",
        draftPrefix: "DRAFT",
        nextInvoiceSequence: 1,
        nextPurchaseSequence: 1,
        nextPaymentSequence: 1,
        nextSaleSequence: 1,
        autoRoundOff: true,
        showSubItemsInInvoice: false,
        authorisedSignature: "",
        termsAndConditions: "",
        footerText: "",
        shareMessageTemplates: { ...DEFAULT_SHARE_MESSAGE_TEMPLATES },
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
    fetchSettings();
  }, [activeShopId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const queryParam = activeShopId ? `?shopId=${activeShopId}` : '';
      const response = await fetch(`/api/settings${queryParam}`);
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
      const queryParam = activeShopId ? `?shopId=${activeShopId}` : '';
      const response = await fetch(`/api/settings${queryParam}`, {
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            {currentShop
              ? `Configure settings for ${currentShop.name}`
              : availableShops.length === 0
                ? 'Configure your default business settings. Create a shop to manage location-specific settings.'
                : 'Configure business and system settings'}
          </p>
        </div>
        <Button onClick={handleSubmit(onSubmit)} disabled={saving} className="hidden sm:inline-flex">
          <Save className="size-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList variant="segmented" className="w-full overflow-x-auto flex-nowrap justify-start">
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
                    <Label htmlFor="business.website">Website</Label>
                    <Input id="business.website" placeholder="e.g. https://example.com" {...register("business.website")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Logo</Label>
                    <div className="space-y-2">
                      {watch("business.logo") ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={watch("business.logo") ?? undefined}
                            alt="Business logo"
                            className="h-12 w-12 object-contain rounded border"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setValue("business.logo", "")}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No logo uploaded</p>
                      )}
                      <Input
                        id="business.logo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="text-xs"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const dataUrl = event.target?.result as string;
                            setValue("business.logo", dataUrl);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>
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
                  Invoice, sale, purchase and payment numbering
                  </CardDescription>
                </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
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
                    <Label htmlFor="billing.salePrefix">Sale Prefix</Label>
                    <Input id="billing.salePrefix" {...register("billing.salePrefix")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing.draftPrefix">Draft Prefix</Label>
                    <Input id="billing.draftPrefix" {...register("billing.draftPrefix")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="billing.nextSaleSequence">Next Sale Number</Label>
                    <Input
                      id="billing.nextSaleSequence"
                      type="number"
                      {...register("billing.nextSaleSequence", { valueAsNumber: true })}
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

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="billing.showSubItemsInInvoice"
                      checked={watch("billing.showSubItemsInInvoice")}
                      onCheckedChange={(checked) => setValue("billing.showSubItemsInInvoice", checked as boolean)}
                    />
                    <Label htmlFor="billing.showSubItemsInInvoice">Show sub-items for compound products/services in invoice</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing.termsAndConditions">Default Terms & Conditions</Label>
                    <Textarea
                      id="billing.termsAndConditions"
                      rows={4}
                      {...register("billing.termsAndConditions")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing.footerText">Footer Text</Label>
                    <Textarea
                      id="billing.footerText"
                      rows={2}
                      placeholder="e.g. Thank you for your business! Visit us again."
                      {...register("billing.footerText")}
                    />
                    <p className="text-xs text-muted-foreground">
                      This text will be displayed at the bottom of invoices (PDF & preview).
                    </p>
                  </div>

                  {/* Authorised Signature Upload */}
                  <div className="space-y-2">
                    <Label>Authorised Signature</Label>
                    <div className="space-y-2">
                      {watch("billing.authorisedSignature") ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={watch("billing.authorisedSignature") ?? undefined}
                            alt="Authorised signature"
                            className="h-16 w-auto object-contain rounded border"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setValue("billing.authorisedSignature", "")}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No signature uploaded</p>
                      )}
                      <Input
                        id="billing.authorisedSignature"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="text-xs"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const dataUrl = event.target?.result as string;
                            setValue("billing.authorisedSignature", dataUrl);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <ShareMessageTemplatesEditor
                  register={register}
                  watch={watch}
                  setValue={setValue}
                />
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

        {/* Mobile save button at bottom */}
        <div className="sm:hidden">
          <Button onClick={handleSubmit(onSubmit)} disabled={saving} className="w-full">
            <Save className="size-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
