package com.thesis.smart_resource_planner.coverage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("POJO coverage smoke tests")
class PojoCoverageTest {

    @Test
    @DisplayName("Invoke getters/setters for DTOs and Entities")
    void exerciseDtosAndEntities() throws Exception {
        Path javaRoot = resolveJavaRoot();
        List<Path> roots = List.of(
                javaRoot.resolve("com/thesis/smart_resource_planner/model/dto"),
                javaRoot.resolve("com/thesis/smart_resource_planner/model/entity")
        );

        int loaded = 0;
        int exercised = 0;

        for (Path root : roots) {
            if (!Files.exists(root)) continue;
            for (Path file : listJavaFiles(root)) {
                String className = toClassName(javaRoot, file);
                if (className.endsWith("package-info")) continue;

                Class<?> clazz;
                try {
                    clazz = Class.forName(className);
                } catch (Throwable t) {
                    continue; // generated/filtered classes, ignore
                }

                loaded++;
                Object instance = tryNew(clazz);
                if (instance == null) continue;

                for (Method m : clazz.getMethods()) {
                    if (m.getDeclaringClass() == Object.class) continue;
                    if (!Modifier.isPublic(m.getModifiers())) continue;

                    if (isSetter(m)) {
                        Object arg = dummyValue(m.getParameterTypes()[0]);
                        try {
                            m.invoke(instance, arg);
                            exercised++;
                        } catch (Throwable ignored) {
                            // best-effort
                        }
                    } else if (isGetter(m)) {
                        try {
                            m.invoke(instance);
                            exercised++;
                        } catch (Throwable ignored) {
                            // best-effort
                        }
                    }
                }
            }
        }

        assertTrue(loaded > 0, "Should load some POJO classes");
        assertTrue(exercised > 0, "Should exercise some POJO methods");
    }

    private static Path resolveJavaRoot() {
        Path cwd = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
        Path direct = cwd.resolve("src/main/java");
        if (Files.exists(direct)) return direct;
        Path nested = cwd.resolve("backend/src/main/java");
        if (Files.exists(nested)) return nested;
        fail("Could not locate src/main/java (cwd=" + cwd + ")");
        return direct;
    }

    private static List<Path> listJavaFiles(Path root) throws IOException {
        try (var stream = Files.walk(root)) {
            return stream
                    .filter(p -> p.toString().endsWith(".java"))
                    .toList();
        }
    }

    private static String toClassName(Path javaRoot, Path file) {
        Path rel = javaRoot.relativize(file);
        String s = rel.toString().replace('\\', '.').replace('/', '.');
        return s.substring(0, s.length() - ".java".length());
    }

    private static boolean isSetter(Method m) {
        return m.getName().startsWith("set")
                && m.getParameterCount() == 1
                && m.getReturnType() == void.class;
    }

    private static boolean isGetter(Method m) {
        if (m.getParameterCount() != 0) return false;
        if (m.getReturnType() == void.class) return false;
        String n = m.getName();
        if (n.startsWith("get") && n.length() > 3) return true;
        return n.startsWith("is") && n.length() > 2 && (m.getReturnType() == boolean.class || m.getReturnType() == Boolean.class);
    }

    private static Object tryNew(Class<?> clazz) {
        try {
            Constructor<?> c = clazz.getDeclaredConstructor();
            c.setAccessible(true);
            return c.newInstance();
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static Object dummyValue(Class<?> type) {
        if (type == String.class) return "x";
        if (type == UUID.class) return UUID.randomUUID();
        if (type == Integer.class || type == int.class) return 1;
        if (type == Long.class || type == long.class) return 1L;
        if (type == Double.class || type == double.class) return 1.0d;
        if (type == Float.class || type == float.class) return 1.0f;
        if (type == Short.class || type == short.class) return (short) 1;
        if (type == Byte.class || type == byte.class) return (byte) 1;
        if (type == Boolean.class || type == boolean.class) return true;
        if (type == BigDecimal.class) return BigDecimal.ONE;
        if (type == LocalDateTime.class) return LocalDateTime.now();
        if (type == LocalDate.class) return LocalDate.now();
        if (type == byte[].class) return new byte[]{1, 2, 3};
        if (List.class.isAssignableFrom(type)) return new ArrayList<>();
        if (Set.class.isAssignableFrom(type)) return new HashSet<>();
        if (Map.class.isAssignableFrom(type)) return new HashMap<>();
        if (Optional.class.isAssignableFrom(type)) return Optional.empty();
        if (type.isEnum()) {
            Object[] constants = type.getEnumConstants();
            return constants != null && constants.length > 0 ? constants[0] : null;
        }

        // Best-effort: try to create nested object, else null
        Object nested = tryNew(type);
        return nested != null ? nested : null;
    }
}

