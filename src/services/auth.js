import api from "./api";

/**
 * Register a new partner
 */
export const register = async (payload) => {
  try {
    const { data } = await api.post("/register", {
      company_name: payload.companyName,
      contact_name: payload.contactName,
      email: payload.email,
      phone: payload.phone,
      business_type: payload.businessType,
      password: payload.password,
    });

    return data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message ||
        error.response?.data?.error ||
        "Registration failed"
    );
  }
};

/**
 * Login
 */
export const login = async (payload) => {
  try {
    const { data } = await api.post("/login", {
      email: payload.email,
      password: payload.password,
    });

    return data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message ||
        error.response?.data?.error ||
        "Login failed"
    );
  }
};

/**
 * Logout
 */
export const logout = async () => {
  try {
    const { data } = await api.post("/logout");

    return data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message ||
        error.response?.data?.error ||
        "Logout failed"
    );
  }
};