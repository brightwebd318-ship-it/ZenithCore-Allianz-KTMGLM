"use server";

import { createServerSupabaseClient, createAdminSupabaseClient } from '../services/serverClient';

// 1. TENANTS
export async function getTenantAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error("No active auth session found");

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  if (profileErr) throw profileErr;
  if (!profile) throw new Error("No user profile found matching the active session");

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', profile.tenant_id)
    .single();
  if (tenantErr) throw tenantErr;
  return tenant;
}

export async function updateTenantAction(accessToken: string, tenantData: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const current = await getTenantAction(accessToken);
  const { data, error } = await supabase
    .from('tenants')
    .update(tenantData)
    .eq('id', current.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 2. USERS / STAFF
export async function getUsersAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return data;
}

export async function getCurrentUserAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return null;
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) {
    console.error("Error fetching current user from public.users:", error);
    return null;
  }
  return data;
}

export async function updateUserPermissionsAction(accessToken: string, userId: string, dbPayload: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('users')
    .update(dbPayload)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addUserAction(accessToken: string, newUserPayload: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('users')
    .insert([newUserPayload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 3. STAFF AUTH AUTOMATION
export async function createStaffAuthAction(
  accessToken: string,
  userEmail: string,
  password?: string,
  fullName?: string,
  role?: string,
  tenantUuid?: string,
  targetUserId?: string
) {
  // 1. Authorize: Verify the caller is an Admin
  const userClient = createServerSupabaseClient(accessToken);
  const { data: profile, error: profileErr } = await userClient
    .from('users')
    .select('position_role')
    .eq('id', (await userClient.auth.getUser()).data.user?.id)
    .single();
  if (profileErr || !profile || profile.position_role !== 'Admin') {
    throw new Error("Access Denied: Only Admin users can create accounts.");
  }

  const adminClient = createAdminSupabaseClient();
  
  // 2. Register user into auth.users (using official Supabase Admin Auth API)
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: userEmail,
    password: password || 'ZenithMockPassword123!',
    email_confirm: true,
    user_metadata: { full_name: fullName || userEmail.split('@')[0] }
  });
  if (authErr) throw authErr;
  if (!authData.user) throw new Error("Failed to create authentication credentials.");
  
  const newUserId = authData.user.id;

  // 3. Link/Upsert to public profile
  const profilePayload: any = {
    id: newUserId,
    tenant_id: tenantUuid,
    email: userEmail,
    full_name: fullName || userEmail.split('@')[0],
    position_role: role || 'Receptionist',
    medical_council_registration_no: 'IMR/TEMP-STAFF',
    can_view_personal_data: true,
    can_view_medical_history: true,
    can_manage_finance: false,
    can_print_generate_invoice: true,
    base_salary_monthly: 45000,
    bonus_system_enabled: false,
    resource_fhir: {
      resourceType: 'Practitioner',
      active: true,
      name: [{ text: fullName || userEmail.split('@')[0] }],
      can_manage_staff: role === 'Admin'
    }
  };

  if (targetUserId && targetUserId !== newUserId) {
    // 3.1. Update all referencing tables to use newUserId
    await adminClient
      .from('clinical_logs')
      .update({ author_id: newUserId })
      .eq('author_id', targetUserId);

    await adminClient
      .from('invoices')
      .update({ generated_by: newUserId })
      .eq('generated_by', targetUserId);

    await adminClient
      .from('invoices')
      .update({ associated_practitioner_id: newUserId })
      .eq('associated_practitioner_id', targetUserId);

    await adminClient
      .from('todo_tasks')
      .update({ assigned_to: newUserId })
      .eq('assigned_to', targetUserId);

    await adminClient
      .from('todo_tasks')
      .update({ created_by: newUserId })
      .eq('created_by', targetUserId);

    await adminClient
      .from('scheduled_sessions')
      .update({ practitioner_id: newUserId })
      .eq('practitioner_id', targetUserId);

    // 3.2. Fetch existing profile so custom clearances, salary, etc. are preserved
    const { data: oldProfile } = await adminClient
      .from('users')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (oldProfile) {
      Object.assign(profilePayload, {
        medical_council_registration_no: oldProfile.medical_council_registration_no || profilePayload.medical_council_registration_no,
        can_view_personal_data: oldProfile.can_view_personal_data ?? profilePayload.can_view_personal_data,
        can_view_medical_history: oldProfile.can_view_medical_history ?? profilePayload.can_view_medical_history,
        can_manage_finance: oldProfile.can_manage_finance ?? profilePayload.can_manage_finance,
        can_print_generate_invoice: oldProfile.can_print_generate_invoice ?? profilePayload.can_print_generate_invoice,
        base_salary_monthly: oldProfile.base_salary_monthly ?? profilePayload.base_salary_monthly,
        bonus_system_enabled: oldProfile.bonus_system_enabled ?? profilePayload.bonus_system_enabled,
        resource_fhir: oldProfile.resource_fhir ?? profilePayload.resource_fhir
      });

      // 3.3. Delete the old user row
      await adminClient
        .from('users')
        .delete()
        .eq('id', targetUserId);
    }
  }

  const { data, error: dbErr } = await adminClient
    .from('users')
    .upsert(profilePayload)
    .select()
    .single();

  if (dbErr) throw dbErr;
  return newUserId;
}

export async function pauseStaffAuthAction(accessToken: string, targetUserId: string, shouldPause: boolean) {
  // 1. Authorize: Verify the caller is an Admin
  const userClient = createServerSupabaseClient(accessToken);
  const { data: profile, error: profileErr } = await userClient
    .from('users')
    .select('position_role')
    .eq('id', (await userClient.auth.getUser()).data.user?.id)
    .single();
  if (profileErr || !profile || profile.position_role !== 'Admin') {
    throw new Error("Access Denied: Only Admin users can suspend/resume accounts.");
  }

  // 2. Toggle ban status using Supabase Admin Auth API
  const adminClient = createAdminSupabaseClient();
  const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
    ban_duration: shouldPause ? '876000h' : 'none' // Ban for 100 years or unban
  });
  if (error) throw error;
  return true;
}

export async function getAuthUsersStatusAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase.rpc('get_auth_users_status');
  if (error) throw error;
  return data || [];
}

// 4. PATIENTS
export async function getPatientsAction(accessToken: string, searchQuery?: string) {
  const supabase = createServerSupabaseClient(accessToken);
  let query = supabase.from('patients').select('*');
  if (searchQuery) {
    query = query.or(
      `resource_fhir->name->0->given->>0.ilike.%${searchQuery}%,resource_fhir->name->0->>family.ilike.%${searchQuery}%,abha_number.ilike.%${searchQuery}%,abha_address.ilike.%${searchQuery}%`
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addPatientAction(accessToken: string, newPatientPayload: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('patients')
    .insert([newPatientPayload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePatientConsentAction(accessToken: string, patientId: string, updates: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', patientId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePatientGstAction(accessToken: string, patientId: string, updates: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', patientId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 5. CLINICAL LOGS
export async function getClinicalLogsAction(accessToken: string, patientId: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('clinical_logs')
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_deleted', false);
  if (error) throw error;
  return data;
}

export async function addClinicalLogAction(accessToken: string, newLogPayload: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('clinical_logs')
    .insert([newLogPayload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function softDeleteClinicalLogAction(accessToken: string, logId: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { error } = await supabase
    .from('clinical_logs')
    .update({ is_deleted: true })
    .eq('id', logId);
  if (error) throw error;
  return true;
}

// 6. INVOICES
export async function getInvoicesAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addInvoiceAction(accessToken: string, dbPayload: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('invoices')
    .insert([dbPayload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateInvoicePaymentStatusAction(accessToken: string, invoiceId: string, newStatus: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('invoices')
    .update({ payment_status: newStatus })
    .eq('id', invoiceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 7. INVENTORY
export async function getInventoryAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase.from('inventory').select('*');
  if (error) throw error;
  return data;
}

export async function addInventoryItemAction(accessToken: string, newItemPayload: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('inventory')
    .insert([newItemPayload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateInventoryStockAction(accessToken: string, itemId: string, newCount: number) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('inventory')
    .update({ stock_count: newCount })
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 8. EXPENSES
export async function getExpensesAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase.from('expenses').select('*');
  if (error) throw error;
  return data;
}

export async function addExpenseAction(accessToken: string, newExpensePayload: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('expenses')
    .insert([newExpensePayload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 9. AUDIT TRAILS
export async function getAuditTrailsAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('system_audit_trails')
    .select('*, performer:performer_id(full_name, email)')
    .order('timestamp', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addAuditTrailAction(accessToken: string, dbRow: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { error } = await supabase.from('system_audit_trails').insert([dbRow]);
  if (error) throw error;
  return true;
}

export async function truncateAuditTrailsAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { error } = await supabase
    .from('system_audit_trails')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
  return true;
}

// 10. TODO TASKS
export async function getTodoTasksAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase.from('todo_tasks').select('*');
  if (error) throw error;
  return data;
}

export async function addTodoTaskAction(accessToken: string, dbPayload: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('todo_tasks')
    .insert([dbPayload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTodoTaskStatusAction(accessToken: string, taskId: string, dbStatus: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('todo_tasks')
    .update({ status: dbStatus })
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 11. SCHEDULED SESSIONS
export async function getScheduledSessionsAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase.from('scheduled_sessions').select('*');
  if (error) throw error;
  return data;
}

export async function addScheduledSessionAction(accessToken: string, dbPayload: any) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .insert([dbPayload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateScheduledSessionStatusAction(accessToken: string, sessionId: string, status: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .update({ status })
    .eq('id', sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 12. NOTIFICATIONS
export async function getSystemNotificationsAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase.from('notifications').select('*');
  if (error) throw error;
  return data;
}

export async function markNotificationAsReadAction(accessToken: string, notificationId: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 13. SPECIAL GATE: Verify and link tenant (for onboarding wizard)
export async function verifyAndLinkTenantAction(accessToken: string, targetTenantId: string) {
  const supabase = createServerSupabaseClient(accessToken);
  
  const { data: tenantData, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, business_name')
    .eq('id', targetTenantId)
    .single();

  if (tenantErr || !tenantData) {
    throw new Error("The entered Tenant ID does not exist in your Supabase database. Please check the ID.");
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    throw new Error("No authenticated user profile found.");
  }

  const { error: uErr } = await supabase
    .from('users')
    .update({ tenant_id: targetTenantId })
    .eq('id', userData.user.id);
  if (uErr) throw uErr;

  return tenantData;
}

// 14. Extra Actions
export async function deleteScheduledSessionAction(accessToken: string, sessionId: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { error } = await supabase.from('scheduled_sessions').delete().eq('id', sessionId);
  if (error) throw error;
  return true;
}

export async function wipeCompletedTasksAction(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { error } = await supabase.from('todo_tasks').delete().eq('status', 'completed');
  if (error) throw error;
  return true;
}

export async function getTenantResourceMetricsAction(accessToken: string, tenantId: string) {
  const supabase = createServerSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from('tenant_resource_metrics')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();
  if (error) throw error;
  return data;
}

export async function initializeTenantAction(newTenant: any, firstAdmin: any) {
  const supabase = createServerSupabaseClient();
  const { error: tErr } = await supabase.from('tenants').insert([newTenant]);
  if (tErr) throw tErr;
  const { error: uErr } = await supabase.from('users').insert([firstAdmin]);
  if (uErr) throw uErr;
  return true;
}

export async function completeOnboardingAction(accessToken: string, tenantId: string, onboardingData: any, userId: string) {
  const supabase = createServerSupabaseClient(accessToken);
  // 1. Update the existing tenant record
  const { error: tErr } = await supabase
    .from('tenants')
    .update({
      business_name: onboardingData.business_name,
      business_type: onboardingData.business_type,
      clinic_start_time: onboardingData.clinic_start_time,
      clinic_end_time: onboardingData.clinic_end_time,
      max_db_storage_mb: onboardingData.max_db_storage_mb,
      max_file_storage_mb: onboardingData.max_file_storage_mb,
    })
    .eq('id', tenantId);
  if (tErr) throw tErr;

  const { error: uErr } = await supabase
    .from('users')
    .update({
      full_name: onboardingData.admin_name,
      resource_fhir: {
        resourceType: 'Practitioner',
        active: true,
        name: [{ text: onboardingData.admin_name }]
      }
    })
    .eq('id', userId);
  if (uErr) throw uErr;
  return true;
}

export async function deleteStaffAction(accessToken: string, userId: string) {
  // 1. Authorize: Verify the caller is an Admin
  const userClient = createServerSupabaseClient(accessToken);
  const { data: profile, error: profileErr } = await userClient
    .from('users')
    .select('position_role')
    .eq('id', (await userClient.auth.getUser()).data.user?.id)
    .single();
  if (profileErr || !profile || profile.position_role !== 'Admin') {
    throw new Error("Access Denied: Only Admin users can delete accounts.");
  }

  const adminClient = createAdminSupabaseClient();

  // 1.5. Satisfy foreign key constraint on invoices by setting associated_practitioner_id to null
  const { error: invErr } = await adminClient
    .from('invoices')
    .update({ associated_practitioner_id: null })
    .eq('associated_practitioner_id', userId);
  if (invErr) {
    console.warn("Failed to set associated_practitioner_id to null in invoices, proceeding:", invErr);
  }
  
  // Delete from auth.users if they exist
  try {
    await adminClient.auth.admin.deleteUser(userId);
  } catch (err) {
    console.warn("Failed to delete auth user, proceeding:", err);
  }

  // Delete from public.users
  const { error: dbErr } = await adminClient
    .from('users')
    .delete()
    .eq('id', userId);
  if (dbErr) throw dbErr;

  return true;
}

