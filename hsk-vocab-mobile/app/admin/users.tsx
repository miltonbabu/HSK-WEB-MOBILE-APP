import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  AlertCircle,
  X,
  ChevronLeft,
  Shield,
  ShieldOff,
  Lock,
  UserX,
  UserPlus,
  DatabaseZap,
  Smartphone,
  Globe,
} from "lucide-react-native";
import { adminService, isSuperAdmin } from "@/services/admin.service";
import { useAuthStore } from "@/stores/auth";
import type { AdminUserRow } from "@/types";

interface UserForm {
  username: string;
  email: string;
  password: string;
  is_admin: boolean;
}

const emptyUserForm: UserForm = {
  username: "",
  email: "",
  password: "",
  is_admin: false,
};

export default function AdminUsersScreen() {
  const activeUser = useAuthStore((s) => s.user);
  const isSuper =
    activeUser?.is_super === true || isSuperAdmin(activeUser?.email ?? null);
  const isAdmin = activeUser?.is_admin === true || isSuper;

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUserForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const next = await adminService.getUsers();
      setUsers(next);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = () => {
    setEditingId(null);
    setForm(emptyUserForm);
    setFormError("");
    setShowForm(true);
  };

  const handleEdit = (u: AdminUserRow) => {
    setEditingId(u.id);
    setForm({
      username: u.username,
      email: u.email,
      password: "",
      is_admin: !!u.is_admin,
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.email || !form.email.trim()) {
      setFormError("Email is required");
      return;
    }
    if (!form.username || !form.username.trim()) {
      setFormError("Username is required");
      return;
    }
    if (!editingId && (!form.password || form.password.length < 4)) {
      setFormError("Password must be at least 4 characters");
      return;
    }
    // Only super admin can promote admins
    if (form.is_admin && !isSuper) {
      setFormError("Only the super administrator can grant admin access");
      return;
    }

    setFormError("");
    setSaving(true);
    try {
      if (editingId) {
        const payload: {
          email?: string;
          username?: string;
          is_admin?: boolean;
          password?: string;
        } = {
          email: form.email.trim(),
          username: form.username.trim(),
        };
        if (isSuper) payload.is_admin = form.is_admin;
        if (form.password && form.password.length >= 4)
          payload.password = form.password;
        await adminService.updateUser(editingId, payload, isSuper);
        showToast("User updated");
      } else {
        await adminService.createUser(form, isSuper);
        showToast("User created");
      }
      setShowForm(false);
      setEditingId(null);
      loadUsers();
    } catch (err: any) {
      setFormError(err?.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (u: AdminUserRow) => {
    if (isSuperAdmin(u.email)) {
      Alert.alert("Cannot delete", "Super admin account cannot be deleted.");
      return;
    }
    setDeleteConfirm(u.id);
  };

  const handleSoftDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await adminService.softDeleteUser(deleteConfirm);
      showToast("User deactivated");
      loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to deactivate user");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await adminService.restoreUser(id);
      showToast("User restored");
      loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to restore user");
    }
  };

  const handleHardDelete = async (id: string) => {
    try {
      await adminService.hardDeleteUser(id, isSuper);
      showToast("User permanently deleted");
      loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to delete user");
    }
  };

  const handleClearData = async (id: string) => {
    try {
      await adminService.clearUserData(id);
      showToast("User data cleared");
      loadUsers();
    } catch (err: any) {
      setError(err?.message || "Failed to clear user data");
    }
  };

  const handleResetPassword = (u: AdminUserRow) => {
    Alert.prompt
      ? Alert.prompt(
          `Reset password for ${u.username}`,
          "Enter a new password (at least 4 characters)",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Reset",
              style: "default",
              onPress: async (text: string | undefined) => {
                if (!text || text.length < 4) {
                  Alert.alert(
                    "Invalid password",
                    "Must be at least 4 characters",
                  );
                  return;
                }
                try {
                  await adminService.resetPassword(u.id, text);
                  showToast("Password reset");
                } catch (err: any) {
                  Alert.alert(
                    "Error",
                    err?.message || "Failed to reset password",
                  );
                }
              },
            },
          ],
          "secure-text",
        )
      : (async () => {
          // Fallback for platforms without Alert.prompt
          const newPwd = "newpass1234";
          await adminService.resetPassword(u.id, newPwd);
          showToast("Password reset to: " + newPwd);
        })();
  };

  if (!isAdmin) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-2 p-4 border-b border-slate-200">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft size={22} color="#0f172a" />
          </Pressable>
          <Text className="text-lg font-bold text-slate-900">Users</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <ShieldOff size={40} color="#94a3b8" />
          <Text className="text-base font-semibold text-slate-700 mt-3">
            Admin access required
          </Text>
          <Text className="text-sm text-slate-500 mt-1 text-center">
            You must be signed in as an administrator to view this page.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft size={22} color="#0f172a" />
          </Pressable>
          <Text className="text-lg font-bold text-slate-900">Users</Text>
          <Text className="text-xs text-slate-500 ml-2">
            {users.length} users
          </Text>
        </View>
        {isSuper && (
          <Pressable
            onPress={handleCreate}
            className="flex-row items-center gap-1 px-3 py-2 rounded-xl bg-indigo-600 active:opacity-80"
          >
            <Plus size={16} color="white" />
            <Text className="text-white text-sm font-semibold">Add</Text>
          </Pressable>
        )}
      </View>

      <View className="flex-row items-center justify-end px-4 py-2">
        <Pressable
          onPress={loadUsers}
          className="flex-row items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 active:opacity-70"
        >
          <RefreshCw size={16} color="#64748b" />
          <Text className="text-sm text-slate-700">Refresh</Text>
        </Pressable>
      </View>

      {error ? (
        <View className="mx-4 my-2 p-3 rounded-xl bg-red-50 flex-row items-center gap-2">
          <AlertCircle size={16} color="#dc2626" />
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator color="#4f46e5" />
          </View>
        ) : users.length === 0 ? (
          <View className="items-center justify-center py-16 px-6">
            <Text className="text-base font-semibold text-slate-700">
              No users found
            </Text>
          </View>
        ) : (
          <View className="px-4 pt-2">
            {users.map((u) => {
              const isSelf = activeUser && u.id === activeUser.id;
              return (
                <View
                  key={u.id}
                  className="flex-row items-center justify-between p-3 mb-2 rounded-xl border border-slate-200 bg-white"
                >
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-base font-bold text-slate-900">
                        {u.username}
                      </Text>
                      {u.is_admin && (
                        <View className="px-2 py-0.5 rounded-md bg-indigo-50">
                          <Text className="text-[10px] font-bold text-indigo-700">
                            ADMIN
                          </Text>
                        </View>
                      )}
                      {!u.is_active && (
                        <View className="px-2 py-0.5 rounded-md bg-slate-100">
                          <Text className="text-[10px] font-bold text-slate-500">
                            DISABLED
                          </Text>
                        </View>
                      )}
                      {u.source === "mobile" || !u.source ? (
                        <View className="px-2 py-0.5 rounded-md bg-emerald-50 flex-row items-center gap-1">
                          <Smartphone size={10} color="#059669" />
                          <Text className="text-[10px] font-bold text-emerald-700">
                            App
                          </Text>
                        </View>
                      ) : (
                        <View className="px-2 py-0.5 rounded-md bg-blue-50 flex-row items-center gap-1">
                          <Globe size={10} color="#2563eb" />
                          <Text className="text-[10px] font-bold text-blue-700">
                            Web
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-slate-500 mt-0.5">
                      {u.email}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    {(isSuper || isSelf) && (
                      <Pressable
                        onPress={() => handleEdit(u)}
                        className="p-2 rounded-lg bg-slate-100 active:opacity-70"
                      >
                        <Edit3 size={16} color="#334155" />
                      </Pressable>
                    )}
                    {(isSuper || isSelf) && (
                      <Pressable
                        onPress={() => handleResetPassword(u)}
                        className="p-2 rounded-lg bg-slate-100 active:opacity-70"
                      >
                        <Lock size={16} color="#334155" />
                      </Pressable>
                    )}
                    {isSuper && !isSuperAdmin(u.email) && (
                      <Pressable
                        onPress={() => handleClearData(u.id)}
                        className="p-2 rounded-lg bg-amber-50 active:opacity-70"
                      >
                        <DatabaseZap size={16} color="#b45309" />
                      </Pressable>
                    )}
                    {isSuper &&
                      !isSuperAdmin(u.email) &&
                      u.is_active !== false && (
                        <Pressable
                          onPress={() => confirmDelete(u)}
                          className="p-2 rounded-lg bg-red-50 active:opacity-70"
                        >
                          <UserX size={16} color="#dc2626" />
                        </Pressable>
                      )}
                    {isSuper &&
                      !isSuperAdmin(u.email) &&
                      u.is_active === false && (
                        <Pressable
                          onPress={() => handleRestore(u.id)}
                          className="p-2 rounded-lg bg-emerald-50 active:opacity-70"
                        >
                          <UserPlus size={16} color="#059669" />
                        </Pressable>
                      )}
                    {isSuper && !isSuperAdmin(u.email) && (
                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            "Permanently Delete",
                            "This will permanently remove the user and all their data. This cannot be undone.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => handleHardDelete(u.id),
                              },
                            ],
                          );
                        }}
                        className="p-2 rounded-lg bg-red-100 active:opacity-70"
                      >
                        <Trash2 size={16} color="#b91c1c" />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit User Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
              <Text className="text-lg font-bold text-slate-900">
                {editingId ? "Edit User" : "Add User"}
              </Text>
              <Pressable
                onPress={() => setShowForm(false)}
                className="p-2 -mr-2"
              >
                <X size={20} color="#475569" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {formError ? (
                <View className="mb-3 p-3 rounded-xl bg-red-50 flex-row items-center gap-2">
                  <AlertCircle size={16} color="#dc2626" />
                  <Text className="text-sm text-red-700 flex-1">
                    {formError}
                  </Text>
                </View>
              ) : null}

              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-700 mb-1">
                  Email
                </Text>
                <TextInput
                  value={form.email}
                  onChangeText={(t) => setForm({ ...form, email: t })}
                  placeholder="user@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-700 mb-1">
                  Username
                </Text>
                <TextInput
                  value={form.username}
                  onChangeText={(t) => setForm({ ...form, username: t })}
                  placeholder="user"
                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </View>

              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-700 mb-1">
                  {editingId ? "Password (leave empty to keep)" : "Password"}
                </Text>
                <TextInput
                  value={form.password}
                  onChangeText={(t) => setForm({ ...form, password: t })}
                  placeholder="••••••••"
                  secureTextEntry
                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </View>

              {isSuper && (
                <Pressable
                  onPress={() => setForm({ ...form, is_admin: !form.is_admin })}
                  className="flex-row items-center justify-between p-3 rounded-xl bg-slate-50 mb-3"
                >
                  <View className="flex-row items-center gap-2">
                    <Shield size={16} color="#4f46e5" />
                    <Text className="text-sm font-semibold text-slate-900">
                      Administrator
                    </Text>
                  </View>
                  <View
                    className={`w-10 h-6 rounded-full ${form.is_admin ? "bg-indigo-600" : "bg-slate-300"} items-${form.is_admin ? "flex-end" : "flex-start"} flex items-center`}
                    style={{
                      justifyContent: form.is_admin ? "flex-end" : "flex-start",
                    }}
                  >
                    <View className="w-5 h-5 rounded-full bg-white m-0.5" />
                  </View>
                </Pressable>
              )}

              <View className="flex-row gap-2 mt-4">
                <Pressable
                  onPress={() => setShowForm(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 active:opacity-70 items-center"
                >
                  <Text className="text-sm font-semibold text-slate-700">
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  className="flex-1 flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 active:opacity-80 disabled:opacity-60"
                >
                  {saving ? <ActivityIndicator color="white" /> : null}
                  <Text className="text-sm font-semibold text-white">
                    {editingId ? "Save Changes" : "Add User"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        visible={!!deleteConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteConfirm(null)}
      >
        <View className="flex-1 bg-black/40 items-center justify-center px-8">
          <View className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
                <UserX size={20} color="#dc2626" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-slate-900">
                  Deactivate User
                </Text>
                <Text className="text-xs text-slate-500">
                  User will be unable to sign in, but their data is preserved.
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2 mt-2">
              <Pressable
                onPress={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 active:opacity-70 items-center"
              >
                <Text className="text-sm font-semibold text-slate-700">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSoftDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 active:opacity-80 items-center"
              >
                <Text className="text-sm font-semibold text-white">
                  Deactivate
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {toast ? (
        <View className="absolute bottom-6 left-0 right-0 items-center">
          <View className="bg-slate-900 px-4 py-2.5 rounded-xl shadow-lg">
            <Text className="text-white text-sm font-medium">{toast}</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
