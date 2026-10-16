
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
import joblib

# Generate synthetic employee salary data
np.random.seed(42)
n_samples = 500

data = pd.DataFrame({
    "Experience (Years)": np.random.randint(0, 20, n_samples),
    "Education Level": np.random.choice(["High School", "Bachelor", "Master", "PhD"], n_samples),
    "Job Role": np.random.choice(["Engineer", "Manager", "Analyst", "HR", "Sales"], n_samples),
    "Location": np.random.choice(["New York", "San Francisco", "Austin", "Remote"], n_samples),
})

# Salary calculation logic with noise
base_salary = (
    data["Experience (Years)"] * 1500 +
    data["Education Level"].map({"High School": 30000, "Bachelor": 45000, "Master": 60000, "PhD": 75000}) +
    data["Job Role"].map({"Engineer": 10000, "Manager": 15000, "Analyst": 8000, "HR": 5000, "Sales": 7000}) +
    data["Location"].map({"New York": 10000, "San Francisco": 12000, "Austin": 5000, "Remote": 0}) +
    np.random.normal(0, 5000, n_samples)
)

data["Salary"] = base_salary.round(2)

# Split into features and label
X = data.drop("Salary", axis=1)
y = data["Salary"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Preprocessing
categorical_features = ["Education Level", "Job Role", "Location"]
numeric_features = ["Experience (Years)"]

preprocessor = ColumnTransformer([
    ("cat", OneHotEncoder(drop="first"), categorical_features),
    ("num", StandardScaler(), numeric_features),
])

# Build pipeline
pipeline = Pipeline([
    ("preprocessor", preprocessor),
    ("model", RandomForestRegressor(n_estimators=100, random_state=42))
])

# Train model
pipeline.fit(X_train, y_train)

# Evaluate
y_pred = pipeline.predict(X_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print(f"Model RMSE: {rmse:.2f}")
print(f"Model R2 Score: {r2:.2f}")

# Save model
joblib.dump(pipeline, "employee_salary_model.pkl")
print("Model saved as employee_salary_model.pkl")
