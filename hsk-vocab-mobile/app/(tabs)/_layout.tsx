import { Tabs } from "expo-router";
import { useColorScheme } from "nativewind";
import { Sparkles, BookOpen, Home, User } from "lucide-react-native";
import { useSettingsStore } from "@/stores/settings";

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#a855f7",
        tabBarInactiveTintColor: dark ? "#6b7280" : "#9ca3af",
        tabBarStyle: {
          backgroundColor: dark ? "#030712" : "#ffffff",
          borderTopColor: dark ? "#1f2937" : "#f3f4f6",
          height: 56,
          paddingTop: 4,
          paddingBottom: 8,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "Learn",
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI Tutor",
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
          tabBarIcon: ({ color, size }) => <User color={color} size={20} />,
        }}
      />
    </Tabs>
  );
}
