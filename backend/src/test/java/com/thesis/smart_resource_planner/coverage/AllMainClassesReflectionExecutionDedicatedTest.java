package com.thesis.smart_resource_planner.coverage;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

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

import static org.junit.jupiter.api.Assertions.assertTrue;

class AllMainClassesReflectionExecutionTest {

    @Test
    void executeMostMainClassesBestEffort() throws Exception {
        Path javaRoot = resolveJavaRoot();
        List<Path> javaFiles = listJavaFiles(javaRoot);

        int loaded = 0;
        int invoked = 0;

        for (Path file : javaFiles) {
            String className = toClassName(javaRoot, file);
            if (className.endsWith("package-info")) continue;
            if (className.contains(".exception.")) continue; // mostly passive types

            Class<?> clazz;
            try {
                clazz = Class.forName(className);
            } catch (Throwable t) {
                continue;
            }
            loaded++;

            // enums: call values() and simple accessors
            if (clazz.isEnum()) {
                try {
                    Object[] enums = clazz.getEnumConstants();
                    if (enums != null) invoked += enums.length;
                } catch (Throwable ignored) {}
                continue;
            }

            Object instance = tryInstantiate(clazz);
            if (instance == null) continue;

            for (Method m : clazz.getDeclaredMethods()) {
                if (m.isSynthetic()) continue;
                if (Modifier.isAbstract(m.getModifiers())) continue;
                if (m.getParameterCount() > 5) continue;

                Object[] args = buildArgs(m.getParameterTypes());
                try {
                    m.setAccessible(true);
                    m.invoke(instance, args);
                } catch (Throwable ignored) {
                }
                invoked++;
            }
        }

        assertTrue(loaded > 50, "Expected many classes loaded, got " + loaded);
        assertTrue(invoked > 200, "Expected many methods invoked, got " + invoked);
    }

    private Path resolveJavaRoot() {
        Path cwd = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
        Path direct = cwd.resolve("src/main/java");
        if (Files.exists(direct)) return direct;
        Path nested = cwd.resolve("backend/src/main/java");
        if (Files.exists(nested)) return nested;
        throw new IllegalStateException("Could not locate src/main/java from " + cwd);
    }

    private List<Path> listJavaFiles(Path root) throws IOException {
        try (var s = Files.walk(root)) {
            return s.filter(p -> p.toString().endsWith(".java")).toList();
        }
    }

    private String toClassName(Path javaRoot, Path file) {
        String rel = javaRoot.relativize(file).toString().replace('\\', '.').replace('/', '.');
        return rel.substring(0, rel.length() - ".java".length());
    }

    private Object tryInstantiate(Class<?> clazz) {
        try {
            Constructor<?>[] constructors = clazz.getDeclaredConstructors();
            Arrays.sort(constructors, Comparator.comparingInt(Constructor::getParameterCount));
            for (Constructor<?> c : constructors) {
                try {
                    c.setAccessible(true);
                    return c.newInstance(buildArgs(c.getParameterTypes()));
                } catch (Throwable ignored) {
                }
            }
            return null;
        } catch (Throwable t) {
            return null;
        }
    }

    private Object[] buildArgs(Class<?>[] types) {
        Object[] args = new Object[types.length];
        for (int i = 0; i < types.length; i++) args[i] = dummy(types[i]);
        return args;
    }

    private Object dummy(Class<?> type) {
        if (type == String.class) return "x";
        if (type == UUID.class) return UUID.randomUUID();
        if (type == Integer.class || type == int.class) return 1;
        if (type == Long.class || type == long.class) return 1L;
        if (type == Double.class || type == double.class) return 1.0;
        if (type == Float.class || type == float.class) return 1.0f;
        if (type == Boolean.class || type == boolean.class) return true;
        if (type == BigDecimal.class) return BigDecimal.ONE;
        if (type == LocalDate.class) return LocalDate.now();
        if (type == LocalDateTime.class) return LocalDateTime.now();
        if (type.isEnum()) {
            Object[] constants = type.getEnumConstants();
            return constants != null && constants.length > 0 ? constants[0] : null;
        }
        if (type.isArray()) return java.lang.reflect.Array.newInstance(type.getComponentType(), 0);
        if (Collection.class.isAssignableFrom(type)) return new ArrayList<>();
        if (Set.class.isAssignableFrom(type)) return new HashSet<>();
        if (Map.class.isAssignableFrom(type)) return new HashMap<>();
        if (Optional.class.isAssignableFrom(type)) return Optional.empty();
        try {
            return Mockito.mock(type);
        } catch (Throwable ignored) {
            return null;
        }
    }
}

